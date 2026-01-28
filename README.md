<p align="center">
  <img src="images/freepik_smart_wallet.png" alt="wAIllet Logo" width="200"/>
</p>
<h1 align="center" style="font-family: 'Comic Sans MS', 'Comic Sans', cursive;">wAIllet</h1>

<p align="center"><b>The AI-Powered Wallet That Actually Protects You</b></p>

## Prerequisites

- **Go** 1.23+
- **Node.js** 18+
- **Docker & Docker Compose** (for MySQL)
- **Chrome** browser

## Project Structure

```
waillet-mono/
├── backend-v2/                 # Go backend API
│   ├── cmd/
│   │   └── server/
│   │       └── main.go         # Application entry point
│   ├── docker/
│   │   ├── Dockerfile
│   │   └── docker-compose.yml  # MySQL + backend containers
│   ├── internal/
│   │   ├── config/             # Configuration (Viper, .env)
│   │   ├── database/           # DB connection & migrations
│   │   │   └── migrations/     # SQL migration files
│   │   ├── dto/                # Request/response data transfer objects
│   │   ├── handler/            # HTTP handlers (controllers)
│   │   │   ├── ai.go           # AI intent parsing endpoint
│   │   │   ├── favorite.go     # Favorites CRUD
│   │   │   ├── health.go       # Health check + shared helpers
│   │   │   ├── middleware.go   # CORS, logging, recovery
│   │   │   ├── network.go      # Network endpoints
│   │   │   ├── policy.go       # Security policies
│   │   │   ├── rpc.go          # Blockchain RPC proxy
│   │   │   ├── simulation.go   # Transaction simulation & risk
│   │   │   └── token.go        # Token endpoints
│   │   ├── models/             # Database models
│   │   │   ├── favorite.go
│   │   │   ├── network.go      # Blockchain networks
│   │   │   ├── policy.go
│   │   │   ├── risk_log.go
│   │   │   └── token.go        # Tokens & token addresses
│   │   ├── repository/         # Data access layer (MySQL queries)
│   │   │   ├── favorite_repo.go
│   │   │   ├── network_repo.go
│   │   │   ├── policy_repo.go
│   │   │   ├── risk_log_repo.go
│   │   │   └── token_repo.go
│   │   └── service/            # Business logic & external APIs
│   │       ├── ai_service.go           # OpenAI integration
│   │       ├── coinmarketcap_service.go # CoinMarketCap price sync
│   │       ├── risk_service.go         # Transaction risk analysis
│   │       ├── rpc_service.go          # Alchemy/Infura RPC proxy
│   │       ├── scam_service.go         # ChainAbuse scam detection
│   │       └── simulation_service.go   # eth_call simulation
│   ├── pkg/
│   │   ├── httputil/           # HTTP client helpers
│   │   └── validator/          # Ethereum address validation
│   ├── tests/
│   │   ├── e2e/                # End-to-end tests
│   │   └── unit/               # Unit tests
│   ├── .env.example            # Environment variable template
│   └── go.mod
│
├── extension/                  # Chrome extension (React + TypeScript)
│   ├── src/
│   │   ├── components/         # React UI components
│   │   ├── constants/          # App constants & storage keys
│   │   ├── context/            # React context (wallet state)
│   │   ├── services/           # API client, wallet, network service
│   │   ├── types/              # TypeScript type definitions
│   │   ├── background.ts       # Extension background script
│   │   ├── content.ts          # Content script (page injection)
│   │   └── inpage.ts           # window.ethereum provider
│   ├── public/                 # Static assets & manifest.json
│   └── package.json
│
└── images/                     # Repo images
```

## Running the Backend

### Option 1: Docker Compose (recommended)

Starts both MySQL and the backend in containers:

```bash
cd backend-v2/docker
docker-compose up -d
```

The backend will be available at `http://localhost:8000`.

### Option 2: Local Development

**1. Start MySQL with Docker:**

```bash
cd backend-v2/docker
docker-compose up -d mysql
```

**2. Configure environment:**

```bash
cd backend-v2
cp .env.example .env
# Edit .env with your API keys
```

Key variables in `.env`:

| Variable | Description |
|----------|-------------|
| `DB_HOST` | MySQL host (default: `localhost`) |
| `DB_PORT` | MySQL port (default: `3306`) |
| `DB_USER` | MySQL user (default: `root`) |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name (default: `waillet`) |
| `OPENAI_API_KEY` | OpenAI API key for AI features |
| `ALCHEMY_API_KEY` | Alchemy RPC key for blockchain calls |
| `CMC_API_KEY` | CoinMarketCap API key for token prices |
| `CMC_SYNC_INTERVAL` | Price sync interval (default: `10m`) |

**3. Run the backend:**

```bash
cd backend-v2
go run cmd/server/main.go
```

The server starts on `http://localhost:8000`. Database tables are created automatically on startup, and default networks are seeded if the `networks` table is empty.

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check with DB status |
| GET | `/api/networks` | List active blockchain networks |
| GET | `/api/networks/{slug}` | Get network by slug |
| GET | `/api/tokens` | List top 100 tokens by market cap |
| GET | `/api/tokens/prices?symbols=ETH,BTC` | Get token prices |
| GET | `/api/tokens/{symbol}` | Get token details with addresses |
| GET | `/api/tokens/network/{slug}` | Tokens available on a network |
| POST | `/api/tokens/sync` | Trigger CoinMarketCap sync |
| GET | `/api/favorites/{wallet}` | Get saved favorites |
| POST | `/api/favorites` | Create a favorite |
| POST | `/api/ai/parse-intent` | Parse natural language command |
| POST | `/api/rpc/proxy` | Proxy blockchain RPC calls |
| POST | `/api/simulate/risk-analysis` | Analyze transaction risk |

## Running the Extension

**1. Install dependencies:**

```bash
cd extension
npm install
```

**2. Build:**

```bash
npm run build
```

**3. Load in Chrome:**

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `extension/dist` folder

## Architecture

```
Chrome Extension  ──────>  Go Backend  ──────>  MySQL
  (React UI)        HTTP     (Chi)       sqlx    (Data)
  (background.ts)                │
  (inpage.ts)                    ├──> OpenAI     (AI intent parsing)
                                 ├──> Alchemy    (Blockchain RPC)
                                 ├──> CoinMarketCap (Token prices)
                                 └──> ChainAbuse (Scam detection)
```

The backend follows a layered architecture: **Handlers** (HTTP) -> **Services** (business logic) -> **Repositories** (data access) -> **Database**.
