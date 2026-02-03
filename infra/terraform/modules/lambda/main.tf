# Lambda Module for Backend API

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for Lambda"
  type        = list(string)
}

variable "vpc_cidr_block" {
  description = "VPC CIDR block"
  type        = string
}

variable "lambda_package_path" {
  description = "Path to Lambda deployment package"
  type        = string
}

variable "app_version" {
  description = "Application version"
  type        = string
}

variable "db_host" {
  description = "Database host"
  type        = string
}

variable "db_port" {
  description = "Database port"
  type        = number
  default     = 3306
}

variable "db_name" {
  description = "Database name"
  type        = string
}

variable "db_username" {
  description = "Database username"
  type        = string
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

variable "cors_origins" {
  description = "CORS allowed origins"
  type        = string
  default     = "*"
}

variable "memory_size" {
  description = "Lambda memory size in MB"
  type        = number
  default     = 256
}

variable "timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 30
}

locals {
  name_prefix   = "waillet-${var.environment}"
  function_name = "${local.name_prefix}-api"
}

# Security Group for Lambda
resource "aws_security_group" "lambda" {
  name        = "${local.name_prefix}-lambda-sg"
  description = "Security group for Lambda function"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${local.name_prefix}-lambda-sg"
    Environment = var.environment
  }
}

# IAM Role for Lambda
resource "aws_iam_role" "lambda" {
  name = "${local.name_prefix}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
  }
}

# IAM Policy for Lambda
resource "aws_iam_role_policy" "lambda" {
  name = "${local.name_prefix}-lambda-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface",
          "ec2:AssignPrivateIpAddresses",
          "ec2:UnassignPrivateIpAddresses"
        ]
        Resource = "*"
      }
    ]
  })
}

# Lambda Function
resource "aws_lambda_function" "api" {
  function_name = local.function_name
  role          = aws_iam_role.lambda.arn
  handler       = "bootstrap"
  runtime       = "provided.al2023"

  filename         = var.lambda_package_path
  source_code_hash = filebase64sha256(var.lambda_package_path)

  memory_size = var.memory_size
  timeout     = var.timeout

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      ENVIRONMENT     = var.environment
      APP_VERSION     = var.app_version
      DB_HOST         = var.db_host
      DB_PORT         = tostring(var.db_port)
      DB_NAME         = var.db_name
      DB_USER         = var.db_username
      DB_PASSWORD     = var.db_password
      JWT_SECRET      = var.jwt_secret
      ALCHEMY_API_KEY = var.alchemy_api_key
      INFURA_API_KEY  = var.infura_api_key
      CMC_API_KEY     = var.cmc_api_key
      CORS_ORIGINS    = var.cors_origins
    }
  }

  tags = {
    Name        = local.function_name
    Environment = var.environment
    Version     = var.app_version
  }
}

# Lambda Function URL (alternative to API Gateway)
resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE"

  cors {
    allow_origins     = split(",", var.cors_origins)
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers     = ["*"]
    allow_credentials = true
    max_age           = 86400
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = var.environment == "production" ? 30 : 7

  tags = {
    Environment = var.environment
  }
}

# Outputs
output "function_name" {
  value = aws_lambda_function.api.function_name
}

output "function_arn" {
  value = aws_lambda_function.api.arn
}

output "function_url" {
  value = aws_lambda_function_url.api.function_url
}

output "security_group_id" {
  value = aws_security_group.lambda.id
}
