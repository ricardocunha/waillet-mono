# Production Environment Configuration

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Remote state - configure your backend
  backend "s3" {
    bucket         = "waillet-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "waillet-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "waillet"
      Environment = "production"
      ManagedBy   = "terraform"
    }
  }
}

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "lambda_package_path" {
  description = "Path to Lambda deployment package"
  type        = string
}

variable "app_version" {
  description = "Application version"
  type        = string
  default     = "latest"
}

variable "alchemy_api_key" {
  description = "Alchemy API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "infura_api_key" {
  description = "Infura API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "cmc_api_key" {
  description = "CoinMarketCap API key"
  type        = string
  sensitive   = true
  default     = ""
}

locals {
  environment        = "production"
  availability_zones = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
}

# Secrets: generate and store in AWS Secrets Manager
resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!@#%^*()-_=+[]{}"
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "db_password" {
  name        = "waillet/${local.environment}/db_password"
  description = "RDS master password for ${local.environment}"
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_password.result
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name        = "waillet/${local.environment}/jwt_secret"
  description = "JWT signing secret for ${local.environment}"
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = random_password.jwt_secret.result
}

# VPC Module
module "vpc" {
  source = "../../modules/vpc"

  environment        = local.environment
  availability_zones = local.availability_zones
  vpc_cidr           = "10.1.0.0/16"
}

# RDS Module
module "rds" {
  source = "../../modules/rds"

  environment    = local.environment
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnet_ids
  vpc_cidr_block = module.vpc.vpc_cidr_block

  db_name     = "waillet"
  db_username = "waillet_admin"
  db_password = random_password.db_password.result

  # Production-specific settings
  instance_class          = "db.t3.small"
  allocated_storage       = 50
  multi_az                = true
  backup_retention_period = 14
}

# Lambda Module
module "lambda" {
  source = "../../modules/lambda"

  environment         = local.environment
  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.private_subnet_ids
  vpc_cidr_block      = module.vpc.vpc_cidr_block
  lambda_package_path = var.lambda_package_path
  app_version         = var.app_version

  # Database connection
  db_host     = module.rds.address
  db_port     = module.rds.port
  db_name     = module.rds.database_name
  db_username = "waillet_admin"
  db_password = random_password.db_password.result

  # API Keys
  jwt_secret      = random_password.jwt_secret.result
  alchemy_api_key = var.alchemy_api_key
  infura_api_key  = var.infura_api_key
  cmc_api_key     = var.cmc_api_key

  # Production-specific settings
  cors_origins = "https://waillet.com,https://app.waillet.com"
  memory_size  = 512
  timeout      = 30

  depends_on = [module.rds]
}

# Outputs
output "api_url" {
  description = "API URL"
  value       = module.lambda.function_url
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.endpoint
  sensitive   = true
}

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}
