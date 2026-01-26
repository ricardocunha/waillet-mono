package models

type AIAction string

const (
	AIActionTransfer       AIAction = "transfer"
	AIActionSwap           AIAction = "swap"
	AIActionApprove        AIAction = "approve"
	AIActionSaveFavorite   AIAction = "save_favorite"
	AIActionDeleteFavorite AIAction = "delete_favorite"
	AIActionListFavorites  AIAction = "list_favorites"
	AIActionUnknown        AIAction = "unknown"
)

type Chain string

const (
	ChainEthereum    Chain = "ethereum"
	ChainSepolia     Chain = "sepolia"
	ChainBase        Chain = "base"
	ChainBaseSepolia Chain = "base-sepolia"
	ChainBSC         Chain = "bsc"
	ChainBSCTestnet  Chain = "bsc-testnet"
	ChainPolygon     Chain = "polygon"
	ChainArbitrum    Chain = "arbitrum"
	ChainOptimism    Chain = "optimism"
)

var SupportedChains = map[string]bool{
	string(ChainEthereum):    true,
	string(ChainSepolia):     true,
	string(ChainBase):        true,
	string(ChainBaseSepolia): true,
	string(ChainBSC):         true,
	string(ChainBSCTestnet):  true,
	string(ChainPolygon):     true,
	string(ChainArbitrum):    true,
	string(ChainOptimism):    true,
}

func IsValidChain(chain string) bool {
	return SupportedChains[chain]
}
