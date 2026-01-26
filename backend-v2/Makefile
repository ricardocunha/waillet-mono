.PHONY: build run test test-integration clean deps migrate docker-build docker-up docker-down lint

# Go parameters
GOCMD=go
GOBUILD=$(GOCMD) build
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
GOMOD=$(GOCMD) mod
BINARY_NAME=waillet-backend
MAIN_PATH=./cmd/server

# Build the application
build:
	$(GOBUILD) -o bin/$(BINARY_NAME) $(MAIN_PATH)

# Run the application
run:
	$(GOCMD) run $(MAIN_PATH)

# Run with hot reload (requires air: go install github.com/cosmtrek/air@latest)
dev:
	air -c .air.toml

# Download dependencies
deps:
	$(GOMOD) download
	$(GOMOD) tidy

# Run unit tests
test:
	$(GOTEST) -v -race -cover ./...

# Run integration tests (requires Docker)
test-integration:
	$(GOTEST) -v -race -tags=integration ./tests/integration/...

# Run e2e tests
test-e2e:
	$(GOTEST) -v -race -tags=e2e ./tests/e2e/...

# Run all tests with coverage
test-coverage:
	$(GOTEST) -v -race -coverprofile=coverage.out ./...
	$(GOCMD) tool cover -html=coverage.out -o coverage.html

# Clean build artifacts
clean:
	rm -rf bin/
	rm -f coverage.out coverage.html

# Run database migrations
migrate-up:
	migrate -path internal/database/migrations -database "mysql://$(DB_USER):$(DB_PASSWORD)@tcp($(DB_HOST):$(DB_PORT))/$(DB_NAME)" up

migrate-down:
	migrate -path internal/database/migrations -database "mysql://$(DB_USER):$(DB_PASSWORD)@tcp($(DB_HOST):$(DB_PORT))/$(DB_NAME)" down

# Build Docker image
docker-build:
	docker build -t waillet-backend-go -f docker/Dockerfile .

# Start Docker Compose
docker-up:
	docker-compose -f docker/docker-compose.yml up -d

# Stop Docker Compose
docker-down:
	docker-compose -f docker/docker-compose.yml down

# Run linter (requires golangci-lint)
lint:
	golangci-lint run ./...

# Format code
fmt:
	$(GOCMD) fmt ./...

# Generate mocks (requires mockgen)
mocks:
	mockgen -source=internal/repository/favorite_repo.go -destination=tests/mocks/mock_favorite_repo.go -package=mocks
	mockgen -source=internal/repository/policy_repo.go -destination=tests/mocks/mock_policy_repo.go -package=mocks
	mockgen -source=internal/repository/risk_log_repo.go -destination=tests/mocks/mock_risk_log_repo.go -package=mocks

# Default target
all: deps build test
