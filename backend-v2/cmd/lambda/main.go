package main

import (
	"context"
	"net/http"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/waillet-app/backend-v2/internal/auth"
	"github.com/waillet-app/backend-v2/internal/config"
	"github.com/waillet-app/backend-v2/internal/database"
	"github.com/waillet-app/backend-v2/internal/handler"
	"github.com/waillet-app/backend-v2/internal/repository"
	"github.com/waillet-app/backend-v2/internal/service"
)

// Version is set at build time
var Version = "dev"

var httpAdapter *httpadapter.HandlerAdapterV2

func init() {
	// Setup logging for Lambda (JSON format)
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	if os.Getenv("DEBUG") == "true" {
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})
	} else {
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	}

	log.Info().Str("version", Version).Msg("Starting Lambda function")

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration")
	}

	// Connect to database
	db, err := database.NewConnection(&cfg.Database)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to database")
	}
	// Note: In Lambda, we don't defer db.Close() as the connection is reused across invocations

	// Run migrations (only on cold start)
	if err := database.RunMigrations(db); err != nil {
		log.Fatal().Err(err).Msg("Failed to run migrations")
	}

	// Initialize repositories
	favoriteRepo := repository.NewFavoriteRepository(db)
	policyRepo := repository.NewPolicyRepository(db)
	riskLogRepo := repository.NewRiskLogRepository(db)
	networkRepo := repository.NewNetworkRepository(db)
	tokenRepo := repository.NewTokenRepository(db)
	authRepo := repository.NewAuthRepository(db)
	chainTypeConfigRepo := repository.NewChainTypeConfigRepository(db)

	// Initialize services
	rpcService := service.NewRPCService(&cfg.RPC, networkRepo)
	scamService := service.NewScamService()
	aiService := service.NewAIService(&cfg.OpenAI, favoriteRepo)
	simulationService := service.NewSimulationService(rpcService)
	riskService := service.NewRiskService(rpcService, scamService, riskLogRepo, &cfg.OpenAI)
	cmcService := service.NewCoinMarketCapService(&cfg.CoinMarketCap, tokenRepo)
	authService := auth.NewAuthService(&cfg.Auth, authRepo)

	// Initialize handlers
	healthHandler := handler.NewHealthHandler(db)
	favoriteHandler := handler.NewFavoriteHandler(favoriteRepo)
	policyHandler := handler.NewPolicyHandler(policyRepo)
	rpcHandler := handler.NewRPCHandler(rpcService)
	aiHandler := handler.NewAIHandler(aiService)
	simulationHandler := handler.NewSimulationHandler(simulationService, riskService)
	networkHandler := handler.NewNetworkHandler(networkRepo)
	tokenHandler := handler.NewTokenHandler(tokenRepo, cmcService)
	settingsHandler := handler.NewSettingsHandler(aiService)
	authHandler := handler.NewAuthHandler(authService)
	chainTypeConfigHandler := handler.NewChainTypeConfigHandler(chainTypeConfigRepo)

	// Setup router
	r := chi.NewRouter()

	// Middleware
	r.Use(handler.RecoveryMiddleware)
	r.Use(handler.CORSMiddleware(&cfg.CORS))
	r.Use(middleware.RequestID)
	r.Use(handler.RequestLogger)
	r.Use(middleware.Timeout(60 * time.Second))

	// Routes
	r.Get("/", healthHandler.Root)
	r.Get("/health", healthHandler.Health)

	r.Route("/api", func(r chi.Router) {
		// Auth (public)
		r.Route("/auth", func(r chi.Router) {
			r.Get("/nonce", authHandler.GetNonce)
			r.Post("/verify", authHandler.VerifySignature)
			r.Post("/refresh", authHandler.RefreshToken)
		})

		// Networks (public)
		r.Route("/networks", func(r chi.Router) {
			r.Get("/", networkHandler.GetAll)
			r.Get("/{slug}", networkHandler.GetBySlug)
		})

		// Chain Type Configs (public)
		r.Route("/chain-types", func(r chi.Router) {
			r.Get("/", chainTypeConfigHandler.GetAll)
			r.Get("/{id}", chainTypeConfigHandler.GetByID)
		})

		// Tokens (public)
		r.Route("/tokens", func(r chi.Router) {
			r.Get("/", tokenHandler.GetAll)
			r.Get("/prices", tokenHandler.GetPrices)
			r.Get("/network/{network_slug}", tokenHandler.GetByNetwork)
			r.Get("/{symbol}", tokenHandler.GetBySymbol)
			r.Post("/sync", tokenHandler.TriggerSync)
		})

		// RPC Proxy (public)
		r.Route("/rpc", func(r chi.Router) {
			r.Post("/proxy", rpcHandler.Proxy)
			r.Get("/health", rpcHandler.Health)
		})

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(auth.AuthMiddleware(cfg.Auth.JWTSecret))

			// Auth (protected)
			r.Get("/auth/me", authHandler.GetCurrentUser)
			r.Post("/auth/logout", authHandler.Logout)

			// Favorites (protected)
			r.Route("/favorites", func(r chi.Router) {
				r.Get("/", favoriteHandler.GetByWallet)
				r.Post("/", favoriteHandler.Create)
				r.Put("/{id}", favoriteHandler.Update)
				r.Delete("/{id}", favoriteHandler.Delete)
			})

			// Policies (protected)
			r.Route("/policies", func(r chi.Router) {
				r.Get("/", policyHandler.GetByWallet)
				r.Post("/", policyHandler.Create)
				r.Delete("/{id}", policyHandler.Delete)
			})

			// AI (protected)
			r.Route("/ai", func(r chi.Router) {
				r.Post("/parse-intent", aiHandler.ParseIntent)
			})

			// Simulation (protected)
			r.Route("/simulate", func(r chi.Router) {
				r.Post("/transaction", simulationHandler.SimulateTransaction)
				r.Post("/risk-analysis", simulationHandler.RiskAnalysis)
				r.Post("/risk-decision", simulationHandler.RiskDecision)
			})

			// Settings (protected)
			r.Route("/settings", func(r chi.Router) {
				r.Get("/openai", settingsHandler.GetOpenAIStatus)
				r.Put("/openai", settingsHandler.UpdateOpenAIKey)
			})
		})
	})

	// Note: Periodic sync is not started in Lambda as it's not suitable for serverless
	// Consider using a separate scheduled Lambda or EventBridge for periodic tasks

	// Create HTTP adapter for Lambda
	httpAdapter = httpadapter.NewV2(http.Handler(r))

	log.Info().Msg("Lambda function initialized successfully")
}

func Handler(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	return httpAdapter.ProxyWithContext(ctx, req)
}

func main() {
	lambda.Start(Handler)
}
