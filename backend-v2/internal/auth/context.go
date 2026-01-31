package auth

import (
	"context"
)

type contextKey string

const walletContextKey contextKey = "wallet_address"

func ContextWithWallet(ctx context.Context, walletAddress string) context.Context {
	return context.WithValue(ctx, walletContextKey, walletAddress)
}

func WalletFromContext(ctx context.Context) string {
	wallet, ok := ctx.Value(walletContextKey).(string)
	if !ok {
		return ""
	}
	return wallet
}
