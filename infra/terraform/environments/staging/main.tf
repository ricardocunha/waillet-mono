# Staging Environment Configuration

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state - configure your backend
  backend "s3" {
    bucket         = "waillet-terraform-state"
    key            = "staging/terraform.tfstate"
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
      Environment = "staging"
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

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
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
  environment        = "staging"
  availability_zones = ["${var.aws_region}a", "${var.aws_region}b"]
}

# VPC Module
module "vpc" {
  source = "../../modules/vpc"

  environment        = local.environment
  availability_zones = local.availability_zones
  vpc_cidr           = "10.0.0.0/16"
}

# RDS Module
module "rds" {
  source = "../../modules/rds"

  environment    = local.environment
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnet_ids
  vpc_cidr_block = module.vpc.vpc_cidr_block

  db_name     = "waillet_staging"
  db_username = "waillet_admin"
  db_password = var.db_password

  # Staging-specific settings
  instance_class          = "db.t3.micro"
  allocated_storage       = 20
  multi_az                = false
  backup_retention_period = 3
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
  db_password = var.db_password

  # API Keys
  jwt_secret      = var.jwt_secret
  alchemy_api_key = var.alchemy_api_key
  infura_api_key  = var.infura_api_key
  cmc_api_key     = var.cmc_api_key

  # Staging-specific settings
  cors_origins = "http://localhost:3000,http://localhost:5173,https://staging.waillet.com"
  memory_size  = 256
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
