.PHONY: help install dev build start test lint typecheck clean docker-build docker-up docker-down docker-logs db-push db-seed db-studio ci

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)Hoodtopia - AI-Powered E-commerce$(NC)"
	@echo ""
	@echo "$(GREEN)Available commands:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'

# Development
install: ## Install dependencies
	@echo "$(BLUE)Installing dependencies...$(NC)"
	npm install --registry https://registry.npmjs.org/

dev: ## Start development server
	@echo "$(BLUE)Starting development server...$(NC)"
	npm run dev

build: ## Build for production
	@echo "$(BLUE)Building application...$(NC)"
	npm run build

start: ## Start production server
	@echo "$(BLUE)Starting production server...$(NC)"
	npm run start

# Testing & Quality
test: ## Run tests
	@echo "$(BLUE)Running tests...$(NC)"
	npm test

test-run: ## Run tests once (CI mode)
	@echo "$(BLUE)Running tests (CI mode)...$(NC)"
	npm run test:run

lint: ## Run ESLint
	@echo "$(BLUE)Running ESLint...$(NC)"
	npm run lint

lint-fix: ## Run ESLint with auto-fix
	@echo "$(BLUE)Running ESLint with auto-fix...$(NC)"
	npm run lint:fix

typecheck: ## Run TypeScript type checking
	@echo "$(BLUE)Running TypeScript type check...$(NC)"
	npm run typecheck

ci: ## Run full CI pipeline locally
	@echo "$(BLUE)Running CI pipeline...$(NC)"
	npm run ci

# Database
db-push: ## Push database schema
	@echo "$(BLUE)Pushing database schema...$(NC)"
	npm run db:push

db-seed: ## Seed database with data
	@echo "$(BLUE)Seeding database...$(NC)"
	npm run db:seed

db-studio: ## Open Drizzle Studio
	@echo "$(BLUE)Opening Drizzle Studio...$(NC)"
	npm run db:studio

db-reset: ## Reset database (drop, push, seed)
	@echo "$(YELLOW)Resetting database...$(NC)"
	rm -f db/hoodtopia.db
	npm run db:push
	npm run db:seed

# Docker
docker-build: ## Build Docker image
	@echo "$(BLUE)Building Docker image...$(NC)"
	docker build -t hoodtopia:latest .

docker-build-dev: ## Build development Docker image
	@echo "$(BLUE)Building development Docker image...$(NC)"
	docker build -f Dockerfile.dev -t hoodtopia:dev .

docker-up: ## Start Docker containers
	@echo "$(BLUE)Starting Docker containers...$(NC)"
	docker-compose up -d

docker-up-dev: ## Start development Docker containers
	@echo "$(BLUE)Starting development Docker containers...$(NC)"
	docker-compose --profile dev up -d

docker-down: ## Stop Docker containers
	@echo "$(BLUE)Stopping Docker containers...$(NC)"
	docker-compose down

docker-logs: ## View Docker container logs
	@echo "$(BLUE)Viewing Docker logs...$(NC)"
	docker-compose logs -f

docker-restart: ## Restart Docker containers
	@echo "$(BLUE)Restarting Docker containers...$(NC)"
	docker-compose restart

docker-shell: ## Open shell in Docker container
	@echo "$(BLUE)Opening shell in container...$(NC)"
	docker-compose exec hoodtopia sh

# Image Generation
generate-images: ## Generate all product images
	@echo "$(BLUE)Generating hoodie images...$(NC)"
	npm run generate:images

generate-accessories: ## Generate accessory images
	@echo "$(BLUE)Generating accessory images...$(NC)"
	npm run generate:accessories

# Cleanup
clean: ## Clean build artifacts and dependencies
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	rm -rf .next
	rm -rf node_modules
	rm -rf dist
	rm -rf coverage
	rm -f package-lock.json

clean-db: ## Remove database file
	@echo "$(YELLOW)Removing database...$(NC)"
	rm -f db/hoodtopia.db

# Quick shortcuts
up: docker-up ## Alias for docker-up
down: docker-down ## Alias for docker-down
logs: docker-logs ## Alias for docker-logs
