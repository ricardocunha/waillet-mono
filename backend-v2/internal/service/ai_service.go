package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/rs/zerolog/log"
	"github.com/sashabaranov/go-openai"
	"github.com/waillet-app/backend-v2/internal/config"
	"github.com/waillet-app/backend-v2/internal/dto"
	"github.com/waillet-app/backend-v2/internal/models"
	"github.com/waillet-app/backend-v2/internal/repository"
)

type AIService struct {
	client       *openai.Client
	model        string
	favoriteRepo repository.FavoriteRepository
}

func NewAIService(cfg *config.OpenAIConfig, favoriteRepo repository.FavoriteRepository) *AIService {
	if cfg.APIKey == "" {
		log.Warn().Msg("OPENAI_API_KEY not set - AI features will be unavailable")
		return &AIService{
			model:        cfg.Model,
			favoriteRepo: favoriteRepo,
		}
	}

	client := openai.NewClient(cfg.APIKey)
	return &AIService{
		client:       client,
		model:        cfg.Model,
		favoriteRepo: favoriteRepo,
	}
}

func (s *AIService) ParseIntent(ctx context.Context, prompt, walletAddress string) (*dto.ParseIntentResponse, error) {
	if s.client == nil {
		return &dto.ParseIntentResponse{
			Action:     string(models.AIActionUnknown),
			Confidence: 0,
			Error:      strPtr("OpenAI API key not configured"),
		}, nil
	}

	favorites, err := s.favoriteRepo.GetByWalletAddress(ctx, walletAddress)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to load favorites for AI parsing")
		favorites = []models.Favorite{}
	}

	favoritesContext := "No saved favorites yet."
	if len(favorites) > 0 {
		var lines []string
		for _, fav := range favorites {
			line := fmt.Sprintf("- %s: %s", fav.Alias, fav.Address)
			if fav.Asset.Valid {
				line += fmt.Sprintf(" (%s)", fav.Asset.String)
			}
			lines = append(lines, line)
		}
		favoritesContext = strings.Join(lines, "\n")
	}

	systemPrompt := fmt.Sprintf(`You are a crypto wallet AI assistant. Parse user commands into structured transaction data.

User's wallet: %s

Saved favorites (shortcuts):
%s

Parse the user's command and return ONLY a JSON object (no markdown, no explanation) with these fields:
{
    "action": "transfer" | "swap" | "approve" | "save_favorite" | "delete_favorite" | "list_favorites" | "unknown",
    "to": recipient address - use ONE of these:
        - If favorite mentioned: use exact address from favorites list above
        - If ENS name (*.eth): preserve it exactly as given (e.g., "vitalik.eth")
        - If email address (user@domain.com): preserve it exactly as given
        - If .waillet alias (name.waillet): preserve it exactly as given
        - If simple alias without suffix: add .waillet (e.g., "ricardo" -> "ricardo.waillet")
        - If 0x address: use it exactly as given
        - If unknown recipient: set action="unknown" and explain in error
        - For save_favorite: the address to save
        - For list_favorites: null
    "value": amount as string (null for save_favorite/list_favorites),
    "token": token symbol (e.g., "USDC", "ETH"),
    "chain": blockchain name if EXPLICITLY specified by user (e.g., "ethereum", "base", "sepolia", "base-sepolia"), or null if not specified,
    "needs_network": true if the user did NOT specify a network and this is a transfer action, false otherwise,
    "resolved_from": favorite alias if used (or null),
    "alias": For save_favorite or delete_favorite - the nickname/alias to save or delete (or null for other actions),
    "confidence": 0-100 (how confident you are),
    "error": error message if command is unclear (or null)
}

CRITICAL NETWORK RULE:
- For transfer/swap/approve actions: If the user does NOT explicitly mention a network (like "on ethereum", "on sepolia", "on base"), set chain=null and needs_network=true
- NEVER assume or default to any network - always ask the user to choose if not specified
- Only set chain to a value if the user EXPLICITLY mentions it in their command

CRITICAL RECIPIENT RESOLUTION (follow this ORDER - favorites have HIGHEST priority):
1. FIRST: Check if recipient matches a favorite alias (case-insensitive)
   - If YES: use the EXACT 0x address from the favorites list, set "resolved_from" to the alias name
   - Example: favorites has "ricardo: 0x1a129CDc5f5E7a2EDaD31BD390aE306C29eC21E7"
     User says "send to ricardo" -> "to": "0x1a129CDc5f5E7a2EDaD31BD390aE306C29eC21E7", "resolved_from": "ricardo"
2. If NOT a favorite AND is an ENS name (*.eth): use it exactly as given
3. If NOT a favorite AND is an email: use it exactly as given
4. If NOT a favorite AND already has .waillet suffix: use it exactly as given
5. If NOT a favorite AND is a simple name without suffix: add .waillet suffix
6. If it's a 0x address: use it exactly as given

IMPORTANT:
- ALWAYS check the favorites list FIRST before adding .waillet suffix!
- Never invent placeholder addresses - if unknown, return the identifier as-is
- Use common token symbols (USDC, ETH, USDT, etc.)

TRANSFER EXAMPLES (network NOT specified - needs_network=true):
- "send 10 USDC to john@gmail.com" -> {"action": "transfer", "to": "john@gmail.com", "value": "10", "token": "USDC", "chain": null, "needs_network": true, "confidence": 95}
- "send 0.1 ETH to ricardo.waillet" -> {"action": "transfer", "to": "ricardo.waillet", "value": "0.1", "token": "ETH", "chain": null, "needs_network": true, "confidence": 95}
- "transfer 5 USDC to maria" -> {"action": "transfer", "to": "maria.waillet", "value": "5", "token": "USDC", "chain": null, "needs_network": true, "confidence": 90}
- "send 1 ETH to binance" -> {"action": "transfer", "to": "0x...", "value": "1", "token": "ETH", "chain": null, "needs_network": true, "resolved_from": "binance", "confidence": 95}

TRANSFER EXAMPLES (network EXPLICITLY specified - needs_network=false):
- "send 1 ETH to binance on ethereum" -> {"action": "transfer", "to": "0x...", "value": "1", "token": "ETH", "chain": "ethereum", "needs_network": false, "resolved_from": "binance", "confidence": 95}
- "send 10 USDC to john@gmail.com on base-sepolia" -> {"action": "transfer", "to": "john@gmail.com", "value": "10", "token": "USDC", "chain": "base-sepolia", "needs_network": false, "confidence": 95}
- "transfer 5 ETH on sepolia to 0x123..." -> {"action": "transfer", "to": "0x123...", "value": "5", "token": "ETH", "chain": "sepolia", "needs_network": false, "confidence": 95}

SAVE FAVORITE EXAMPLES (no network needed):
- "save favorite johndoe 0x123..." -> {"action": "save_favorite", "alias": "johndoe", "to": "0x123...", "needs_network": false, "confidence": 95}
- "save 0x123... as binance" -> {"action": "save_favorite", "alias": "binance", "to": "0x123...", "needs_network": false, "confidence": 95}
- "add favorite alice.eth" -> {"action": "save_favorite", "alias": "alice", "to": "alice.eth", "needs_network": false, "confidence": 95}

LIST FAVORITES EXAMPLES:
- "show my favorites" -> {"action": "list_favorites", "confidence": 100}
- "list favorites" -> {"action": "list_favorites", "confidence": 100}
- "what are my saved addresses" -> {"action": "list_favorites", "confidence": 95}
- "my contacts" -> {"action": "list_favorites", "confidence": 90}
- "show saved" -> {"action": "list_favorites", "confidence": 85}

DELETE FAVORITE EXAMPLES:
- "delete ricardo1 from favorites" -> {"action": "delete_favorite", "alias": "ricardo1", "confidence": 95}
- "remove binance from my favorites" -> {"action": "delete_favorite", "alias": "binance", "confidence": 95}
- "delete favorite alice" -> {"action": "delete_favorite", "alias": "alice", "confidence": 90}
- "remove contact john" -> {"action": "delete_favorite", "alias": "john", "confidence": 85}`, walletAddress, favoritesContext)

	resp, err := s.client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model: s.model,
		Messages: []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleSystem, Content: systemPrompt},
			{Role: openai.ChatMessageRoleUser, Content: prompt},
		},
		Temperature: 0.3,
		MaxTokens:   300,
	})

	if err != nil {
		return &dto.ParseIntentResponse{
			Action:     string(models.AIActionUnknown),
			Confidence: 0,
			Error:      strPtr(fmt.Sprintf("AI service error: %v", err)),
		}, nil
	}

	result := strings.TrimSpace(resp.Choices[0].Message.Content)

	if strings.HasPrefix(result, "```") {
		parts := strings.Split(result, "```")
		if len(parts) >= 2 {
			result = parts[1]
			if strings.HasPrefix(result, "json") {
				result = result[4:]
			}
			result = strings.TrimSpace(result)
		}
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(result), &parsed); err != nil {
		return &dto.ParseIntentResponse{
			Action:     string(models.AIActionUnknown),
			Confidence: 0,
			Error:      strPtr(fmt.Sprintf("Failed to parse AI response: %v", err)),
		}, nil
	}

	response := &dto.ParseIntentResponse{
		Action:       getStringOr(parsed, "action", "unknown"),
		NeedsNetwork: getBoolOr(parsed, "needs_network", false),
		Confidence:   getIntOr(parsed, "confidence", 0),
	}

	if to, ok := parsed["to"].(string); ok && to != "" {
		response.To = &to
	}
	if value, ok := parsed["value"].(string); ok && value != "" {
		response.Value = &value
	}
	if token, ok := parsed["token"].(string); ok && token != "" {
		response.Token = &token
	}
	if chain, ok := parsed["chain"].(string); ok && chain != "" {
		response.Chain = &chain
	}
	if resolvedFrom, ok := parsed["resolved_from"].(string); ok && resolvedFrom != "" {
		response.ResolvedFrom = &resolvedFrom
	}
	if alias, ok := parsed["alias"].(string); ok && alias != "" {
		response.Alias = &alias
	}
	if errMsg, ok := parsed["error"].(string); ok && errMsg != "" {
		response.Error = &errMsg
	}

	// Include favorites list when action is list_favorites
	if response.Action == "list_favorites" {
		favoriteItems := make([]dto.FavoriteItem, len(favorites))
		for i, fav := range favorites {
			item := dto.FavoriteItem{
				Alias:   fav.Alias,
				Address: fav.Address,
			}
			if fav.Asset.Valid {
				item.Asset = &fav.Asset.String
			}
			favoriteItems[i] = item
		}
		response.Favorites = favoriteItems
	}

	return response, nil
}

func (s *AIService) GenerateRiskExplanation(ctx context.Context, riskAnalysis *dto.RiskAnalysisResponse, toAddress string, valueUSD float64) string {
	if s.client == nil {
		return s.fallbackRiskExplanation(riskAnalysis, toAddress, valueUSD)
	}

	var factorDescriptions []string
	for _, factor := range riskAnalysis.Factors {
		factorDescriptions = append(factorDescriptions, fmt.Sprintf("- %s: %s", factor.Title, factor.Description))
	}

	factorsText := "No specific risk factors detected"
	if len(factorDescriptions) > 0 {
		factorsText = strings.Join(factorDescriptions, "\n")
	}

	isContract := riskAnalysis.IsContract

	systemPrompt := `You are a security expert. Explain transaction risks in 1-2 SHORT sentences.

Rules:
- Be concise and direct
- No technical jargon
- State the risk clearly
- Give one actionable tip if helpful

Examples:
- "Simple wallet transfer. Safe to proceed."
- "Unlimited token approval requested. Consider setting a specific limit."
- "Unverified contract - source code not public. Verify on block explorer first."
- "Large transfer amount. Double-check the recipient address."
- "Known scam address. Do not proceed."`

	contractStr := "No"
	if isContract {
		contractStr = "Yes"
	}

	userPrompt := fmt.Sprintf(`Transaction Details:
- Recipient: %s...
- Value: $%.2f USD
- Risk Score: %d/100 (%s)
- Contract Interaction: %s

Risk Factors:
%s

Explain this transaction's risks in 2-3 simple sentences.`,
		truncateAddress(toAddress), valueUSD, riskAnalysis.RiskScore, riskAnalysis.RiskLevel, contractStr, factorsText)

	resp, err := s.client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model: s.model,
		Messages: []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleSystem, Content: systemPrompt},
			{Role: openai.ChatMessageRoleUser, Content: userPrompt},
		},
		Temperature: 0.5,
		MaxTokens:   150,
	})

	if err != nil {
		log.Error().Err(err).Msg("Risk explanation generation failed")
		return s.fallbackRiskExplanation(riskAnalysis, toAddress, valueUSD)
	}

	explanation := strings.TrimSpace(resp.Choices[0].Message.Content)
	log.Info().Int("length", len(explanation)).Msg("Generated risk explanation")
	return explanation
}

func (s *AIService) fallbackRiskExplanation(riskAnalysis *dto.RiskAnalysisResponse, toAddress string, valueUSD float64) string {
	riskScore := riskAnalysis.RiskScore

	mainFactor := ""
	if len(riskAnalysis.Factors) > 0 {
		mainFactor = riskAnalysis.Factors[0].Description
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
	}

	if mainFactor == "" {
		mainFactor = "Standard transaction."
	}
	return fmt.Sprintf("Low risk (%d/100). %s Safe to proceed.", riskScore, mainFactor)
}

func truncateAddress(addr string) string {
	if len(addr) > 10 {
		return addr[:10]
	}
	return addr
}

func strPtr(s string) *string {
	return &s
}

func getStringOr(m map[string]interface{}, key, defaultVal string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return defaultVal
}

func getBoolOr(m map[string]interface{}, key string, defaultVal bool) bool {
	if v, ok := m[key].(bool); ok {
		return v
	}
	return defaultVal
}

func getIntOr(m map[string]interface{}, key string, defaultVal int) int {
	if v, ok := m[key].(float64); ok {
		return int(v)
	}
	return defaultVal
}
