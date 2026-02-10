package dto

import "time"

type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
}

type HealthResponse struct {
	Status    string `json:"status"`
	Version   string `json:"version,omitempty"`
	Database  string `json:"database,omitempty"`
	Timestamp string `json:"timestamp,omitempty"`
}

type FavoriteResponse struct {
	ID            int64     `json:"id"`
	WalletAddress string    `json:"wallet_address"`
	Alias         string    `json:"alias"`
	Address       string    `json:"address"`
	Asset         *string   `json:"asset,omitempty"`
	Type          string    `json:"type"`
	Value         *string   `json:"value,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type PolicyResponse struct {
	ID            int64     `json:"id"`
	WalletAddress string    `json:"wallet_address"`
	PolicyType    string    `json:"policy_type"`
	TargetAddress *string   `json:"target_address,omitempty"`
	Chain         string    `json:"chain"`
	LimitAmount   *float64  `json:"limit_amount,omitempty"`
	IsActive      bool      `json:"is_active"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type FavoriteItem struct {
	Alias   string  `json:"alias"`
	Address string  `json:"address"`
	Asset   *string `json:"asset,omitempty"`
}

type ParseIntentResponse struct {
	Action       string         `json:"action"`
	To           *string        `json:"to,omitempty"`
	Value        *string        `json:"value,omitempty"`
	Token        *string        `json:"token,omitempty"`
	Chain        *string        `json:"chain,omitempty"`
	NeedsNetwork bool           `json:"needs_network"`
	ResolvedFrom *string        `json:"resolved_from,omitempty"`
	Alias        *string        `json:"alias,omitempty"`
	FromToken    *string        `json:"from_token,omitempty"`
	ToToken      *string        `json:"to_token,omitempty"`
	FromChain    *string        `json:"from_chain,omitempty"`
	ToChain      *string        `json:"to_chain,omitempty"`
	Slippage     *float64       `json:"slippage,omitempty"`
	Confidence   int            `json:"confidence"`
	Error        *string        `json:"error,omitempty"`
	Favorites    []FavoriteItem `json:"favorites,omitempty"`
}

type SimulationResponse struct {
	Success        bool            `json:"success"`
	BalanceChanges []BalanceChange `json:"balance_changes"`
	Events         []EventLog      `json:"events"`
	GasUsed        uint64          `json:"gas_used"`
	Error          *string         `json:"error,omitempty"`
	RevertReason   *string         `json:"revert_reason,omitempty"`
}

type BalanceChange struct {
	Address string `json:"address"`
	Token   string `json:"token"`
	Change  string `json:"change"`
}

type EventLog struct {
	Name    string                 `json:"name"`
	Args    map[string]interface{} `json:"args"`
	Address string                 `json:"address"`
}

type RiskFactor struct {
	Type        string `json:"type"`
	Severity    string `json:"severity"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Points      int    `json:"points"`
}

type Recommendation struct {
	Icon   string `json:"icon"`
	Text   string `json:"text"`
	Action string `json:"action"`
}

type ContractInfo struct {
	IsContract        bool    `json:"is_contract"`
	Verified          bool    `json:"verified"`
	Name              *string `json:"name,omitempty"`
	VerificationError *string `json:"verification_error,omitempty"`
}

type RiskAnalysisResponse struct {
	LogID           int64            `json:"log_id"`
	RiskScore       int              `json:"risk_score"`
	RiskLevel       string           `json:"risk_level"`
	Factors         []RiskFactor     `json:"factors"`
	AISummary       string           `json:"ai_summary"`
	Recommendations []Recommendation `json:"recommendations"`
	IsScam          bool             `json:"is_scam"`
	ScamInfo        *ScamInfo        `json:"scam_info,omitempty"`
	ValueUSD        float64          `json:"value_usd"`
	IsContract      bool             `json:"is_contract"`
	ContractInfo    *ContractInfo    `json:"contract_info,omitempty"`
}

type ScamInfo struct {
	Reported bool   `json:"reported"`
	Category string `json:"category,omitempty"`
	Reports  int    `json:"reports,omitempty"`
}

type RiskDecisionResponse struct {
	Success bool   `json:"success"`
	LogID   int64  `json:"log_id"`
	Message string `json:"message"`
}

type RPCResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      interface{} `json:"id"`
	Result  interface{} `json:"result,omitempty"`
	Error   *RPCError   `json:"error,omitempty"`
}

type RPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type RPCHealthResponse struct {
	Status          string            `json:"status"`
	Chains          map[string]string `json:"chains"`
	SupportedChains []string          `json:"supported_chains"`
}

type NonceResponse struct {
	Nonce   string `json:"nonce"`
	Message string `json:"message"`
}

type AuthTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
	TokenType    string `json:"token_type"`
}

type CurrentUserResponse struct {
	WalletAddress string `json:"wallet_address"`
}
