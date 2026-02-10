package config

import (
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server        ServerConfig
	Database      DatabaseConfig
	OpenAI        OpenAIConfig
	RPC           RPCConfig
	CORS          CORSConfig
	CoinMarketCap CoinMarketCapConfig
	Auth          AuthConfig
	Lifi          LifiConfig
}

type LifiConfig struct {
	APIKey  string
	BaseURL string
}

type AuthConfig struct {
	JWTSecret       string
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
	NonceTTL        time.Duration
	Domain          string
}

type ServerConfig struct {
	Host         string
	Port         int
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	Debug        bool
}

type DatabaseConfig struct {
	Host            string
	Port            int
	User            string
	Password        string
	DBName          string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
}

type OpenAIConfig struct {
	APIKey string
	Model  string
}

type RPCConfig struct {
	AlchemyAPIKey string
	InfuraAPIKey  string
	Timeout       time.Duration
}

type CORSConfig struct {
	AllowedOrigins []string
	AllowedMethods []string
	AllowedHeaders []string
}

type CoinMarketCapConfig struct {
	APIKey       string
	SyncInterval time.Duration
}

func Load() (*Config, error) {
	viper.SetConfigName(".env")
	viper.SetConfigType("env")
	viper.AddConfigPath(".")
	viper.AddConfigPath("..")
	viper.AddConfigPath("../..")

	viper.AutomaticEnv()
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	// Set defaults
	viper.SetDefault("HOST", "0.0.0.0")
	viper.SetDefault("PORT", 8000)
	viper.SetDefault("DEBUG", false)
	viper.SetDefault("READ_TIMEOUT", "30s")
	viper.SetDefault("WRITE_TIMEOUT", "30s")

	viper.SetDefault("DB_HOST", "localhost")
	viper.SetDefault("DB_PORT", 3306)
	viper.SetDefault("DB_USER", "root")
	viper.SetDefault("DB_PASSWORD", "")
	viper.SetDefault("DB_NAME", "waillet")
	viper.SetDefault("DB_MAX_OPEN_CONNS", 25)
	viper.SetDefault("DB_MAX_IDLE_CONNS", 5)
	viper.SetDefault("DB_CONN_MAX_LIFETIME", "5m")

	viper.SetDefault("OPENAI_MODEL", "gpt-4o-mini")
	viper.SetDefault("RPC_TIMEOUT", "30s")

	viper.SetDefault("CORS_ORIGINS", "*")
	viper.SetDefault("CORS_METHODS", "GET,POST,PUT,DELETE,OPTIONS")
	viper.SetDefault("CORS_HEADERS", "Accept,Authorization,Content-Type,X-CSRF-Token")

	viper.SetDefault("CMC_SYNC_INTERVAL", "10m")

	viper.SetDefault("LIFI_BASE_URL", "https://li.quest/v1")

	viper.SetDefault("JWT_SECRET", "")
	viper.SetDefault("JWT_ACCESS_TTL", "15m")
	viper.SetDefault("JWT_REFRESH_TTL", "168h")
	viper.SetDefault("AUTH_NONCE_TTL", "10m")
	viper.SetDefault("AUTH_DOMAIN", "localhost")

	// Try to read config file (optional)
	_ = viper.ReadInConfig()

	readTimeout, err := time.ParseDuration(viper.GetString("READ_TIMEOUT"))
	if err != nil {
		readTimeout = 30 * time.Second
	}
	writeTimeout, err := time.ParseDuration(viper.GetString("WRITE_TIMEOUT"))
	if err != nil {
		writeTimeout = 30 * time.Second
	}
	connMaxLifetime, err := time.ParseDuration(viper.GetString("DB_CONN_MAX_LIFETIME"))
	if err != nil {
		connMaxLifetime = 5 * time.Minute
	}
	rpcTimeout, err := time.ParseDuration(viper.GetString("RPC_TIMEOUT"))
	if err != nil {
		rpcTimeout = 30 * time.Second
	}
	cmcSyncInterval, err := time.ParseDuration(viper.GetString("CMC_SYNC_INTERVAL"))
	if err != nil {
		cmcSyncInterval = 10 * time.Minute
	}

	jwtAccessTTL, err := time.ParseDuration(viper.GetString("JWT_ACCESS_TTL"))
	if err != nil {
		jwtAccessTTL = 15 * time.Minute
	}
	jwtRefreshTTL, err := time.ParseDuration(viper.GetString("JWT_REFRESH_TTL"))
	if err != nil {
		jwtRefreshTTL = 168 * time.Hour
	}
	authNonceTTL, err := time.ParseDuration(viper.GetString("AUTH_NONCE_TTL"))
	if err != nil {
		authNonceTTL = 10 * time.Minute
	}

	cfg := &Config{
		Server: ServerConfig{
			Host:         viper.GetString("HOST"),
			Port:         viper.GetInt("PORT"),
			ReadTimeout:  readTimeout,
			WriteTimeout: writeTimeout,
			Debug:        viper.GetBool("DEBUG"),
		},
		Database: DatabaseConfig{
			Host:            viper.GetString("DB_HOST"),
			Port:            viper.GetInt("DB_PORT"),
			User:            viper.GetString("DB_USER"),
			Password:        viper.GetString("DB_PASSWORD"),
			DBName:          viper.GetString("DB_NAME"),
			MaxOpenConns:    viper.GetInt("DB_MAX_OPEN_CONNS"),
			MaxIdleConns:    viper.GetInt("DB_MAX_IDLE_CONNS"),
			ConnMaxLifetime: connMaxLifetime,
		},
		OpenAI: OpenAIConfig{
			APIKey: viper.GetString("OPENAI_API_KEY"),
			Model:  viper.GetString("OPENAI_MODEL"),
		},
		RPC: RPCConfig{
			AlchemyAPIKey: viper.GetString("ALCHEMY_API_KEY"),
			InfuraAPIKey:  viper.GetString("INFURA_API_KEY"),
			Timeout:       rpcTimeout,
		},
		CORS: CORSConfig{
			AllowedOrigins: strings.Split(viper.GetString("CORS_ORIGINS"), ","),
			AllowedMethods: strings.Split(viper.GetString("CORS_METHODS"), ","),
			AllowedHeaders: strings.Split(viper.GetString("CORS_HEADERS"), ","),
		},
		CoinMarketCap: CoinMarketCapConfig{
			APIKey:       viper.GetString("CMC_API_KEY"),
			SyncInterval: cmcSyncInterval,
		},
		Auth: AuthConfig{
			JWTSecret:       viper.GetString("JWT_SECRET"),
			AccessTokenTTL:  jwtAccessTTL,
			RefreshTokenTTL: jwtRefreshTTL,
			NonceTTL:        authNonceTTL,
			Domain:          viper.GetString("AUTH_DOMAIN"),
		},
		Lifi: LifiConfig{
			APIKey:  viper.GetString("LIFI_API_KEY"),
			BaseURL: viper.GetString("LIFI_BASE_URL"),
		},
	}

	return cfg, nil
}

func (c *DatabaseConfig) DSN() string {
	return c.User + ":" + c.Password + "@tcp(" + c.Host + ":" + string(rune(c.Port)) + ")/" + c.DBName + "?parseTime=true&charset=utf8mb4"
}
