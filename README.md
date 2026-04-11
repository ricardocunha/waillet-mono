<p align="center">
  <img src="images/freepik_smart_wallet.png" alt="wAIllet Logo" width="200"/>
</p>
<h1 align="center" style="font-family: 'Comic Sans MS', 'Comic Sans', cursive;">wAIllet</h1>

<p align="center"><b>The AI-Powered Wallet That Actually Protects You</b></p>
<p align="center">
  <a href="https://www.loom.com/share/0689551755124a29ba8dfd02597f2dc9">
    <img alt="Watch Demo on Loom" src="https://img.shields.io/badge/Watch%20Demo%20on%20Loom-Click%20Here-ff6b35?style=for-the-badge&logo=loom&logoColor=white">
  </a>
</p>

## Browser Extensions

- Firefox: [Install wAIllet (beta)](https://addons.mozilla.org/pt-BR/firefox/addon/waillet-beta/)
- Chrome: Coming soon

## Prerequisites

- **Go** 1.23+
- **Node.js** 20+
- **Python** 3.11+
- 
- **uv** (Python package manager — `pip install uv`)
- **Docker & Docker Compose** (for MySQL)
- **Chrome** or **Firefox** browser

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
├── dapp/                       # Decentralized app (React + Vite)
│   ├── src/
│   └── package.json
│
├── extension/                  # Browser extension (React + TypeScript)
│   ├── src/
│   │   ├── components/         # React UI components
│   │   ├── constants/          # App constants & storage keys
│   │   ├── context/            # React context (wallet state)
│   │   ├── services/           # API client, wallet, network service
│   │   ├── types/              # TypeScript type definitions
│   │   ├── utils/
│   │   │   └── browser-api.ts  # Chrome/Firefox API compatibility layer
│   │   ├── background.ts       # Extension background script
│   │   ├── content.ts          # Content script (page injection)
│   │   └── inpage.ts           # window.ethereum provider
│   ├── public/
│   │   ├── manifest.json       # Chrome manifest
│   │   └── manifest.firefox.json # Firefox manifest
│   ├── dist/                   # Chrome build output
│   ├── dist-firefox/           # Firefox build output
│   ├── build-firefox.js        # Firefox build script
│   ├── FIREFOX_SETUP.html      # Visual Firefox setup guide
│   └── package.json
│
└── images/                     # Repo images
```

## Running the Backend

### Database Migrations

Tables and seed data are managed automatically via GORM on startup. If you need to reset the database:

```bash
# Drop and recreate the database
docker exec -it waillet-mysql mysql -u root -p -e "DROP DATABASE waillet; CREATE DATABASE waillet;"
# Then restart the backend — it will re-create all tables and re-seed networks
```

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
| `LOG_LEVEL` | Log verbosity: `debug`, `info`, `warn`, `error` (default: `info`) |
| `PORT` | HTTP server port (default: `8000`) |
| `CHAINABUSE_API_KEY` | ChainAbuse API key for scam address lookups |
| `CORS_ORIGINS` | Comma-separated allowed origins (default: `*` in dev) |

**3. Run the backend:**

```bash
cd backend-v2
go run cmd/server/main.go
```

> **Tip:** For hot-reload during development, use [air](https://github.com/air-verse/air): `air` (run from `backend-v2/`).

The server starts on `http://localhost:8000`. Database tables are created automatically on startup via GORM auto-migrate, and default networks are seeded if the `networks` table is empty. No manual migration step is needed.

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
| DELETE | `/api/favorites/{wallet}/{id}` | Delete a saved favorite |
| PATCH | `/api/favorites/{id}` | Update alias or asset of a favorite |
| GET | `/api/auth/nonce` | Get SIWE nonce for wallet sign-in |
| POST | `/api/auth/verify` | Verify SIWE signature, return JWT tokens |


## Testing

### Backend

```bash
cd backend-v2
go test ./...
```

### Extension

```bash
cd extension
npm test
```

### E2E

```bash
cd extension
npm run test:e2e
```

See `extension/e2e/README.md` for full E2E setup instructions.

## Running the Extension

**1. Install dependencies:**

```bash
cd extension
npm install
```

**2. Lint and type-check (optional but recommended):**

```bash
npm run lint
npm run typecheck
```


**4. Build:**

```bash
npm run build
```

**5. Watch mode (auto-rebuild on file change):**

```bash
npm run dev:watch
```

**6. Load in Chrome:**

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `extension/dist` folder

### Running on Firefox

**1. Build for Firefox:**

```bash
cd extension
npm install
npm run build:firefox
```

This creates a Firefox-compatible build in `extension/dist-firefox`.

**2. Load in Firefox (Temporary - for development):**

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Navigate to `extension/dist-firefox`
4. Select the `manifest.json` file

**Alternative: Using web-ext CLI:**

```bash
cd extension
npm run dev:firefox
```

This auto-reloads the extension when files change.


**Note:** Temporary add-ons are removed when Firefox closes. To keep the extension across sessions, use Firefox Developer Edition and set `xpinstall.signatures.required` to `false` in `about:config`, then reload the extension as a permanent add-on. For persistent installation, the extension needs to be signed by Mozilla or installed in Firefox Developer Edition/Nightly with `xpinstall.signatures.required` set to `false` in `about:config`.

For a detailed visual guide, open `extension/FIREFOX_SETUP.html` in your browser.

## Useful Make Targets

If a `Makefile` is present at the repo root, these targets are available:

```bash
make backend      # Start backend with docker-compose
make extension    # Build the Chrome extension
make test         # Run all tests (backend + extension)
make lint         # Run linters across all packages
```

## Troubleshooting

**Backend fails to start:**
- Check `.env` exists and has valid `DB_HOST`, `DB_USER`, `DB_PASSWORD`
- Ensure MySQL container is running: `docker ps | grep mysql`
- Check port 8000 isn't already in use: `lsof -i :8000`

**Extension not loading in Chrome:**
- Make sure `npm run build` completed without errors
- Verify `extension/dist/manifest.json` exists
- Check the Chrome extension error log at `chrome://extensions/`
- Try removing the extension and re-loading the unpacked folder
- Open `chrome://extensions/` → click "Errors" on the extension tile for details

**RPC calls failing:**
- Confirm `ALCHEMY_API_KEY` is set in `.env`
- The free Alchemy tier may rate-limit heavy testing — use a dedicated key


**Debugging the extension:**
1. Open `chrome://extensions/` → click "service worker" link on the wAIllet tile
2. This opens DevTools for the background script
3. Use the Console and Network tabs to trace RPC and API calls

## Architecture

```
DApp (React/Vite)  ──────┐
                          │
Browser Extension  ──────>  Go Backend  ──────>  MySQL
(Chrome/Firefox)     HTTP     (Chi)       sqlx    (Data)
  (React UI)                       │
  (background.ts)                  ├──> OpenAI     (AI intent parsing)
  (inpage.ts)                      ├──> Alchemy    (Blockchain RPC)
                                   ├──> CoinMarketCap (Token prices)
                                   └──> ChainAbuse (Scam detection)
```

The backend follows a layered architecture: **Handlers** (HTTP) -> **Services** (business logic) -> **Repositories** (data access) -> **Database**.

> **Future:** A Redis cache layer is planned between Services and external APIs (Alchemy, CoinMarketCap) to reduce latency and API costs.
