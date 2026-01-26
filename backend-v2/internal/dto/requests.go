package dto

type CreateFavoriteRequest struct {
	WalletAddress string  `json:"wallet_address"`
	Alias         string  `json:"alias"`
	Address       string  `json:"address"`
	Asset         *string `json:"asset,omitempty"`
	Type          string  `json:"type,omitempty"`
	Value         *string `json:"value,omitempty"`
}

type UpdateFavoriteRequest struct {
	Alias   *string `json:"alias,omitempty"`
	Address *string `json:"address,omitempty"`
	Asset   *string `json:"asset,omitempty"`
	Type    *string `json:"type,omitempty"`
	Value   *string `json:"value,omitempty"`
}

type CreatePolicyRequest struct {
	WalletAddress string   `json:"wallet_address"`
	PolicyType    string   `json:"policy_type"`
	TargetAddress *string  `json:"target_address,omitempty"`
	Chain         string   `json:"chain"`
	LimitAmount   *float64 `json:"limit_amount,omitempty"`
}

type ParseIntentRequest struct {
	Prompt        string `json:"prompt"`
	WalletAddress string `json:"wallet_address"`
}

type RPCProxyRequest struct {
	Chain   string      `json:"chain"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params"`
	ID      interface{} `json:"id,omitempty"`
	JSONRPC string      `json:"jsonrpc,omitempty"`
}

type SimulateTransactionRequest struct {
	From  string  `json:"from"`
	To    string  `json:"to"`
	Value string  `json:"value,omitempty"`
	Data  string  `json:"data,omitempty"`
	Token *string `json:"token,omitempty"`
	Chain string  `json:"chain,omitempty"`
}

type RiskAnalysisRequest struct {
	From          string `json:"from"`
	To            string `json:"to"`
	Value         string `json:"value,omitempty"`
	Data          string `json:"data,omitempty"`
	WalletAddress string `json:"wallet_address"`
	Chain         string `json:"chain,omitempty"`
}

type RiskDecisionRequest struct {
	LogID    int64  `json:"log_id"`
	Decision string `json:"decision"`
	TxHash   string `json:"tx_hash,omitempty"`
}
