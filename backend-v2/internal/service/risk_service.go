package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/waillet-app/backend-v2/internal/config"
	"github.com/waillet-app/backend-v2/internal/dto"
	"github.com/waillet-app/backend-v2/internal/models"
	"github.com/waillet-app/backend-v2/internal/repository"
)

type contractCacheEntry struct {
	IsContract        bool
	Verified          bool
	Name              string
	VerificationError string
	Timestamp         time.Time
}

type priceCacheEntry struct {
	Price     float64
	Timestamp time.Time
}

type RiskService struct {
	rpcService    *RPCService
	scamService   *ScamService
	riskLogRepo   repository.RiskLogRepository
	openAIConfig  *config.OpenAIConfig
	contractCache map[string]*contractCacheEntry
	priceCache    map[string]*priceCacheEntry
	cacheMu       sync.RWMutex
	httpClient    *http.Client
}

func NewRiskService(rpcService *RPCService, scamService *ScamService, riskLogRepo repository.RiskLogRepository, openAIConfig *config.OpenAIConfig) *RiskService {
	return &RiskService{
		rpcService:    rpcService,
		scamService:   scamService,
		riskLogRepo:   riskLogRepo,
		openAIConfig:  openAIConfig,
		contractCache: make(map[string]*contractCacheEntry),
		priceCache:    make(map[string]*priceCacheEntry),
		httpClient:    &http.Client{Timeout: 2 * time.Second},
	}
}

func (s *RiskService) AnalyzeTransaction(ctx context.Context, chain, fromAddress, toAddress, value, data, walletAddress string) (*dto.RiskAnalysisResponse, error) {
	log.Info().
		Str("chain", chain).
		Str("from", truncate(fromAddress, 10)).
		Str("to", truncate(toAddress, 10)).
		Msg("Analyzing transaction risk")

	riskScore := 0
	var factors []dto.RiskFactor
	var recommendations []dto.Recommendation

	type asyncResult struct {
		name   string
		result interface{}
		err    error
	}

	resultCh := make(chan asyncResult, 4)

	go func() {
		isScam, scamInfo := s.scamService.IsScam(ctx, toAddress, chain)
		resultCh <- asyncResult{name: "scam", result: map[string]interface{}{"is_scam": isScam, "info": scamInfo}}
	}()

	go func() {
		contractInfo := s.checkContract(ctx, chain, toAddress)
		resultCh <- asyncResult{name: "contract", result: contractInfo}
	}()

	go func() {
		points, desc, usd := s.checkValueRisk(ctx, value)
		resultCh <- asyncResult{name: "value", result: map[string]interface{}{"points": points, "desc": desc, "usd": usd}}
	}()

	go func() {
		wallet := walletAddress
		if wallet == "" {
			wallet = fromAddress
		}
		firstInteraction := s.checkInteractionHistory(ctx, wallet, toAddress)
		resultCh <- asyncResult{name: "interaction", result: firstInteraction}
	}()

	results := make(map[string]interface{})
	for i := 0; i < 4; i++ {
		r := <-resultCh
		results[r.name] = r.result
	}

	isUnlimited, _ := s.checkUnlimitedApproval(data)
	hasDelegatecall := s.checkDelegatecall(data)

	scamResult := results["scam"].(map[string]interface{})
	isScam := scamResult["is_scam"].(bool)
	scamInfo := scamResult["info"]

	contractInfo := results["contract"].(*contractCacheEntry)

	valueResult := results["value"].(map[string]interface{})
	valuePoints := valueResult["points"].(int)
	valueDesc := valueResult["desc"]
	valueUSD := valueResult["usd"].(float64)

	firstInteraction := results["interaction"].(bool)

	var scamInfoResponse *dto.ScamInfo
	if isScam {
		riskScore += 50
		scamInfoTyped := scamInfo.(*ScamInfo)
		factors = append(factors, dto.RiskFactor{
			Type:        "SCAM_ADDRESS",
			Severity:    "CRITICAL",
			Title:       "Scam Detected",
			Description: fmt.Sprintf("Reported for %s. Do not send.", scamInfoTyped.Reason),
			Points:      50,
		})
		recommendations = append(recommendations, dto.Recommendation{
			Icon:   "🚫",
			Text:   "Block this transaction",
			Action: "block",
		})
		scamInfoResponse = &dto.ScamInfo{
			Reported: true,
			Category: scamInfoTyped.Reason,
			Reports:  scamInfoTyped.Reports,
		}
	}

	if isUnlimited {
		riskScore += 40
		factors = append(factors, dto.RiskFactor{
			Type:        "UNLIMITED_APPROVAL",
			Severity:    "HIGH",
			Title:       "Unlimited Approval",
			Description: "Grants full access to your tokens. Consider limiting the amount.",
			Points:      40,
		})
		recommendations = append(recommendations, dto.Recommendation{
			Icon:   "⚙️",
			Text:   "Set a specific limit instead",
			Action: "limit_approval",
		})
	}

	if hasDelegatecall {
		riskScore += 40
		factors = append(factors, dto.RiskFactor{
			Type:        "DELEGATECALL",
			Severity:    "HIGH",
			Title:       "Advanced Call",
			Description: "Uses delegatecall - can execute code in your wallet context.",
			Points:      40,
		})
		recommendations = append(recommendations, dto.Recommendation{
			Icon:   "🛡️",
			Text:   "Only proceed if you trust this contract",
			Action: "verify_source",
		})
	}

	if valuePoints > 0 && valueDesc != nil {
		riskScore += valuePoints
		factors = append(factors, dto.RiskFactor{
			Type:        "LARGE_VALUE",
			Severity:    "MEDIUM",
			Title:       "Large Amount",
			Description: valueDesc.(string),
			Points:      valuePoints,
		})
		recommendations = append(recommendations, dto.Recommendation{
			Icon:   "🔍",
			Text:   "Double-check the recipient",
			Action: "verify_recipient",
		})
	}

	if contractInfo.IsContract && !contractInfo.Verified {
		riskScore += 35
		verificationReason := contractInfo.VerificationError
		if verificationReason == "" {
			verificationReason = "Source code not published"
		}
		factors = append(factors, dto.RiskFactor{
			Type:        "UNVERIFIED_CONTRACT",
			Severity:    "MEDIUM",
			Title:       "Unverified Contract",
			Description: fmt.Sprintf("Could not verify this contract. %s.", verificationReason),
			Points:      35,
		})
		recommendations = append(recommendations, dto.Recommendation{
			Icon:   "📄",
			Text:   "Check contract on block explorer first",
			Action: "verify_contract",
		})
	}

	if firstInteraction && contractInfo.IsContract {
		riskScore += 10
		factors = append(factors, dto.RiskFactor{
			Type:        "FIRST_INTERACTION",
			Severity:    "LOW",
			Title:       "New Contract",
			Description: "First time interacting with this address.",
			Points:      10,
		})
		recommendations = append(recommendations, dto.Recommendation{
			Icon:   "🕵️",
			Text:   "Research before first use",
			Action: "research",
		})
	}

	if !contractInfo.IsContract && data == "0x" {
		riskScore += 5
		factors = append(factors, dto.RiskFactor{
			Type:        "EOA_TRANSFER",
			Severity:    "LOW",
			Title:       "Simple Transfer",
			Description: "Direct wallet-to-wallet transfer.",
			Points:      5,
		})
	}

	if riskScore > 100 {
		riskScore = 100
	}

	riskLevel := string(models.GetRiskLevel(riskScore))

	if len(recommendations) == 0 {
		recommendations = append(recommendations, dto.Recommendation{
			Icon:   "✓",
			Text:   "Transaction appears safe to proceed",
			Action: "proceed",
		})
	}

	aiSummary := s.generateFallbackSummary(riskScore, riskLevel, factors)

	wallet := walletAddress
	if wallet == "" {
		wallet = fromAddress
	}

	paramsJSON, _ := json.Marshal(map[string]string{
		"from":  fromAddress,
		"to":    toAddress,
		"value": value,
		"data":  data,
	})

	riskLog := &models.RiskLog{
		WalletAddress: wallet,
		Method:        "eth_sendTransaction",
		Params:        sql.NullString{String: string(paramsJSON), Valid: true},
		RiskScore:     riskScore,
		AISummary:     sql.NullString{String: aiSummary, Valid: true},
		Decision:      models.DecisionPending,
	}

	if err := s.riskLogRepo.Create(ctx, riskLog); err != nil {
		log.Error().Err(err).Msg("Failed to create risk log")
	}

	log.Info().
		Int("risk_score", riskScore).
		Str("risk_level", riskLevel).
		Msg("Risk analysis complete")

	var contractInfoResponse *dto.ContractInfo
	if contractInfo != nil {
		var verificationError *string
		if contractInfo.VerificationError != "" {
			verificationError = &contractInfo.VerificationError
		}
		var name *string
		if contractInfo.Name != "" {
			name = &contractInfo.Name
		}
		contractInfoResponse = &dto.ContractInfo{
			IsContract:        contractInfo.IsContract,
			Verified:          contractInfo.Verified,
			Name:              name,
			VerificationError: verificationError,
		}
	}

	return &dto.RiskAnalysisResponse{
		LogID:           riskLog.ID,
		RiskScore:       riskScore,
		RiskLevel:       riskLevel,
		Factors:         factors,
		AISummary:       aiSummary,
		Recommendations: recommendations,
		IsScam:          isScam,
		ScamInfo:        scamInfoResponse,
		ValueUSD:        valueUSD,
		IsContract:      contractInfo.IsContract,
		ContractInfo:    contractInfoResponse,
	}, nil
}

func (s *RiskService) UpdateDecision(ctx context.Context, logID int64, decision string, txHash string) error {
	var d models.Decision
	switch strings.ToLower(decision) {
	case "approved":
		d = models.DecisionApproved
	case "blocked":
		d = models.DecisionBlocked
	default:
		d = models.DecisionPending
	}

	return s.riskLogRepo.UpdateDecision(ctx, logID, d, txHash)
}

func (s *RiskService) checkContract(ctx context.Context, chain, address string) *contractCacheEntry {
	cacheKey := fmt.Sprintf("%s:%s", chain, strings.ToLower(address))

	s.cacheMu.RLock()
	if cached, ok := s.contractCache[cacheKey]; ok {
		if time.Since(cached.Timestamp) < 24*time.Hour {
			s.cacheMu.RUnlock()
			return cached
		}
	}
	s.cacheMu.RUnlock()

	result, err := s.rpcService.Call(ctx, chain, "eth_getCode", []interface{}{address, "latest"})
	if err != nil {
		return &contractCacheEntry{
			IsContract:        false,
			Verified:          false,
			VerificationError: fmt.Sprintf("Could not check contract: %s", truncate(err.Error(), 50)),
		}
	}

	code := ""
	if resultStr, ok := result.(string); ok {
		code = resultStr
	}
	isContract := code != "0x" && code != "0x0" && code != ""

	entry := &contractCacheEntry{
		IsContract: isContract,
		Verified:   false,
		Timestamp:  time.Now(),
	}

	if isContract {
		entry.VerificationError = "Verification service unavailable"
	}

	s.cacheMu.Lock()
	s.contractCache[cacheKey] = entry
	s.cacheMu.Unlock()

	return entry
}

func (s *RiskService) checkUnlimitedApproval(data string) (bool, map[string]string) {
	if data == "" || data == "0x" {
		return false, nil
	}

	if len(data) >= 10 && strings.ToLower(data[:10]) == "0x095ea7b3" {
		if len(data) >= 74 {
			amountHex := data[10:74]
			fCount := 0
			for _, c := range strings.ToLower(amountHex) {
				if c == 'f' {
					fCount++
				}
			}
			if fCount >= 60 {
				return true, map[string]string{"symbol": "tokens", "method": "approve"}
			}
		}
	}

	return false, nil
}

func (s *RiskService) checkDelegatecall(data string) bool {
	if data == "" || data == "0x" {
		return false
	}
	return strings.Contains(strings.ToLower(data), "f4")
}

func (s *RiskService) checkValueRisk(ctx context.Context, value string) (int, interface{}, float64) {
	if value == "" || value == "0x" || value == "0x0" {
		return 0, nil, 0.0
	}

	valueInt, ok := new(big.Int).SetString(strings.TrimPrefix(value, "0x"), 16)
	if !ok || valueInt.Cmp(big.NewInt(0)) == 0 {
		return 0, nil, 0.0
	}

	valueFloat := new(big.Float).SetInt(valueInt)
	valueEth, _ := new(big.Float).Quo(valueFloat, big.NewFloat(1e18)).Float64()

	ethPrice := s.getETHPriceUSD(ctx)
	valueUSD := valueEth * ethPrice

	if valueUSD >= 10000 {
		return 25, fmt.Sprintf("High value: $%.2f", valueUSD), valueUSD
	} else if valueUSD >= 1000 {
		return 20, fmt.Sprintf("Large transfer: $%.2f", valueUSD), valueUSD
	} else if valueUSD >= 100 {
		return 10, fmt.Sprintf("Moderate amount: $%.2f", valueUSD), valueUSD
	} else {
		return 5, fmt.Sprintf("Small amount: $%.2f", valueUSD), valueUSD
	}
}

func (s *RiskService) getETHPriceUSD(ctx context.Context) float64 {
	cacheKey := "eth_usd"

	s.cacheMu.RLock()
	if cached, ok := s.priceCache[cacheKey]; ok {
		if time.Since(cached.Timestamp) < 5*time.Minute {
			s.cacheMu.RUnlock()
			return cached.Price
		}
	}
	s.cacheMu.RUnlock()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", nil)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to create price request")
		return 2000.0
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Warn().Err(err).Msg("Price fetch failed, using fallback")
		return 2000.0
	}
	defer resp.Body.Close()

	var data struct {
		Ethereum struct {
			USD float64 `json:"usd"`
		} `json:"ethereum"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		log.Warn().Err(err).Msg("Failed to decode price response")
		return 2000.0
	}

	s.cacheMu.Lock()
	s.priceCache[cacheKey] = &priceCacheEntry{
		Price:     data.Ethereum.USD,
		Timestamp: time.Now(),
	}
	s.cacheMu.Unlock()

	return data.Ethereum.USD
}

func (s *RiskService) checkInteractionHistory(ctx context.Context, walletAddress, contractAddress string) bool {
	hasPrevious, err := s.riskLogRepo.HasPreviousInteraction(ctx, walletAddress, contractAddress)
	if err != nil {
		log.Debug().Err(err).Msg("History check error")
		return false
	}
	return !hasPrevious
}

func (s *RiskService) generateFallbackSummary(riskScore int, riskLevel string, factors []dto.RiskFactor) string {
	mainFactor := ""
	if len(factors) > 0 {
		mainFactor = factors[0].Description
	}

	if riskScore >= 70 {
		if mainFactor == "" {
			mainFactor = "Potential security issue detected."
		}
		return fmt.Sprintf("High risk (%d/100). %s Only proceed if you trust this recipient.", riskScore, mainFactor)
	} else if riskScore >= 30 {
		if mainFactor == "" {
			mainFactor = "Could not fully verify this transaction."
		}
		return fmt.Sprintf("Medium risk (%d/100). %s Review details before confirming.", riskScore, mainFactor)
	} else {
		if mainFactor == "" {
			mainFactor = "Standard transaction."
		}
		return fmt.Sprintf("Low risk (%d/100). %s Safe to proceed.", riskScore, mainFactor)
	}
}
