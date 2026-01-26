package service

import (
	"context"
	"fmt"
	"math/big"
	"strconv"
	"strings"

	"github.com/rs/zerolog/log"
	"github.com/waillet-app/backend-v2/internal/dto"
)

const TransferEventSignature = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

type SimulationService struct {
	rpcService *RPCService
}

func NewSimulationService(rpcService *RPCService) *SimulationService {
	return &SimulationService{rpcService: rpcService}
}

var nativeTokens = map[string]string{
	"sepolia":      "ETH",
	"base-sepolia": "ETH",
	"ethereum":     "ETH",
	"polygon":      "MATIC",
	"bsc":          "BNB",
	"bsc-testnet":  "BNB",
	"base":         "ETH",
}

func (s *SimulationService) SimulateTransaction(ctx context.Context, chain, from, to, value, data string, token *string) *dto.SimulationResponse {
	log.Info().
		Str("chain", chain).
		Str("from", truncate(from, 10)).
		Str("to", truncate(to, 10)).
		Msg("Simulating transaction")

	fromHex := strings.TrimPrefix(from, "0x")
	toHex := strings.TrimPrefix(to, "0x")

	if !isValidHex(fromHex) || !isValidHex(toHex) {
		errMsg := "Invalid address format: addresses must contain only hexadecimal characters"
		return &dto.SimulationResponse{
			Success:        false,
			BalanceChanges: []dto.BalanceChange{},
			Events:         []dto.EventLog{},
			GasUsed:        0,
			Error:          &errMsg,
		}
	}

	originalFrom := strings.ToLower(from)
	if !strings.HasPrefix(originalFrom, "0x") {
		originalFrom = "0x" + originalFrom
	}
	originalTo := strings.ToLower(to)
	if !strings.HasPrefix(originalTo, "0x") {
		originalTo = "0x" + originalTo
	}

	fromHex = padHex(fromHex, 40)
	toHex = padHex(toHex, 40)
	fromPadded := "0x" + fromHex
	toPadded := "0x" + toHex

	formattedValue := "0x0"
	if value != "" && value != "0x" && value != "0x0" {
		hexValue := strings.TrimPrefix(value, "0x")
		if len(hexValue)%2 != 0 {
			hexValue = "0" + hexValue
		}
		formattedValue = "0x" + hexValue
	}

	if data == "" {
		data = "0x"
	}

	txObject := map[string]string{
		"from":  fromPadded,
		"to":    toPadded,
		"value": formattedValue,
		"data":  data,
	}

	_, err := s.ethCall(ctx, chain, txObject)
	if err != nil {
		errMsg := err.Error()
		revertReason := extractRevertReason(errMsg)
		return &dto.SimulationResponse{
			Success:        false,
			BalanceChanges: []dto.BalanceChange{},
			Events:         []dto.EventLog{},
			GasUsed:        0,
			Error:          &errMsg,
			RevertReason:   revertReason,
		}
	}

	gasEstimate, err := s.estimateGas(ctx, chain, txObject)
	if err != nil {
		errMsg := err.Error()
		revertReason := extractRevertReason(errMsg)
		return &dto.SimulationResponse{
			Success:        false,
			BalanceChanges: []dto.BalanceChange{},
			Events:         []dto.EventLog{},
			GasUsed:        0,
			Error:          &errMsg,
			RevertReason:   revertReason,
		}
	}

	var balanceChanges []dto.BalanceChange
	valueInt := big.NewInt(0)
	if formattedValue != "0x0" {
		valueInt, _ = new(big.Int).SetString(strings.TrimPrefix(formattedValue, "0x"), 16)
	}

	if valueInt.Cmp(big.NewInt(0)) > 0 {
		valueEth := new(big.Float).Quo(
			new(big.Float).SetInt(valueInt),
			new(big.Float).SetFloat64(1e18),
		)
		nativeToken := getNativeToken(chain)

		balanceChanges = append(balanceChanges, dto.BalanceChange{
			Address: originalFrom,
			Token:   nativeToken,
			Change:  fmt.Sprintf("-%.6f", valueEth),
		})
		balanceChanges = append(balanceChanges, dto.BalanceChange{
			Address: originalTo,
			Token:   nativeToken,
			Change:  fmt.Sprintf("+%.6f", valueEth),
		})
	}

	var events []dto.EventLog
	if data != "0x" && len(data) > 10 {
		events = parseTransferLogs(originalFrom, originalTo, data, token)
	}

	return &dto.SimulationResponse{
		Success:        true,
		BalanceChanges: balanceChanges,
		Events:         events,
		GasUsed:        gasEstimate,
		Error:          nil,
		RevertReason:   nil,
	}
}

func (s *SimulationService) ethCall(ctx context.Context, chain string, txObject map[string]string) (string, error) {
	log.Debug().Interface("tx_object", txObject).Msg("eth_call")

	result, err := s.rpcService.Call(ctx, chain, "eth_call", []interface{}{txObject, "latest"})
	if err != nil {
		return "", err
	}

	if resultStr, ok := result.(string); ok {
		return resultStr, nil
	}

	return "0x", nil
}

func (s *SimulationService) estimateGas(ctx context.Context, chain string, txObject map[string]string) (uint64, error) {
	result, err := s.rpcService.Call(ctx, chain, "eth_estimateGas", []interface{}{txObject})
	if err != nil {
		return 0, err
	}

	if resultStr, ok := result.(string); ok {
		gasHex := strings.TrimPrefix(resultStr, "0x")
		gas, err := strconv.ParseUint(gasHex, 16, 64)
		if err != nil {
			return 21000, nil
		}
		return gas, nil
	}

	return 21000, nil
}

func getNativeToken(chain string) string {
	if token, ok := nativeTokens[strings.ToLower(chain)]; ok {
		return token
	}
	return "ETH"
}

func parseTransferLogs(from, to, data string, token *string) []dto.EventLog {
	if !strings.HasPrefix(strings.ToLower(data), "0xa9059cbb") {
		return nil
	}

	if len(data) < 138 {
		return nil
	}

	recipientHex := data[10:74]
	recipient := "0x" + recipientHex[len(recipientHex)-40:]

	amountHex := data[74:138]
	amountInt, ok := new(big.Int).SetString(amountHex, 16)
	if !ok {
		return nil
	}

	decimals := 18
	if token != nil {
		tokenUpper := strings.ToUpper(*token)
		if tokenUpper == "USDC" || tokenUpper == "USDT" {
			decimals = 6
		}
	}

	divisor := new(big.Float).SetFloat64(float64(1))
	for i := 0; i < decimals; i++ {
		divisor.Mul(divisor, big.NewFloat(10))
	}

	amountFormatted := new(big.Float).Quo(
		new(big.Float).SetInt(amountInt),
		divisor,
	)

	return []dto.EventLog{
		{
			Name: "Transfer",
			Args: map[string]interface{}{
				"from":  from,
				"to":    recipient,
				"value": fmt.Sprintf("%.6f", amountFormatted),
			},
			Address: to,
		},
	}
}

func extractRevertReason(errMsg string) *string {
	errLower := strings.ToLower(errMsg)

	if strings.Contains(errLower, "execution reverted") {
		if strings.Contains(errMsg, ":") {
			parts := strings.Split(errMsg, ":")
			if len(parts) > 1 {
				reason := strings.TrimSpace(parts[len(parts)-1])
				return &reason
			}
		}
		reason := "Transaction reverted"
		return &reason
	}

	if strings.Contains(errLower, "insufficient funds") || strings.Contains(errLower, "insufficient balance") {
		reason := "Insufficient balance for transaction"
		return &reason
	}

	if strings.Contains(errLower, "gas required exceeds allowance") {
		reason := "Insufficient gas"
		return &reason
	}

	if strings.Contains(errLower, "invalid address") {
		reason := "Invalid recipient address"
		return &reason
	}

	return nil
}

func isValidHex(s string) bool {
	for _, c := range s {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return len(s) > 0
}

func padHex(s string, length int) string {
	s = strings.ToLower(s)
	for len(s) < length {
		s = "0" + s
	}
	return s
}

func truncate(s string, length int) string {
	if len(s) > length {
		return s[:length] + "..."
	}
	return s
}
