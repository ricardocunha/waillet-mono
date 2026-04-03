# Production Environment - Low Cost (Lambda + TiDB Serverless + CloudFront)

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

  backend "s3" {
    bucket         = "waillet-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "waillet-terraform-locks"
  }
}

provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "waillet"
      Environment = "production"
      ManagedBy   = "terraform"
    }
  }
}

# Variables
variable "lambda_package_path" {
  description = "Path to Lambda deployment package"
  type        = string
}

variable "app_version" {
  description = "Application version"
  type        = string
  default     = "latest"
}

variable "db_host" {
  description = "TiDB Serverless host"
  type        = string
}

variable "db_port" {
  description = "TiDB Serverless port"
  type        = string
  default     = "4000"
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "waillet"
}

variable "db_user" {
  description = "Database username"
  type        = string
}

variable "db_password" {
  description = "Database password"
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
  environment = "production"
  domain      = "waillet.link"
  api_domain  = "api.waillet.link"
}

# ──────────────────────────────────────────────
# JWT Secret
# ──────────────────────────────────────────────
resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

# ──────────────────────────────────────────────
# Route53 Hosted Zone
# ──────────────────────────────────────────────
resource "aws_route53_zone" "main" {
  name = local.domain
}

# ──────────────────────────────────────────────
# ACM Certificate (wildcard)
# ──────────────────────────────────────────────
resource "aws_acm_certificate" "main" {
  domain_name               = local.domain
  subject_alternative_names = ["*.${local.domain}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  zone_id         = aws_route53_zone.main.zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 60
  records         = [each.value.record]
}

resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# ──────────────────────────────────────────────
# Lambda IAM Role
# ──────────────────────────────────────────────
resource "aws_iam_role" "lambda" {
  name = "waillet-production-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ──────────────────────────────────────────────
# Lambda Function (no VPC)
# ──────────────────────────────────────────────
resource "aws_lambda_function" "api" {
  function_name = "waillet-production-api"
  role          = aws_iam_role.lambda.arn
  handler       = "bootstrap"
  runtime       = "provided.al2023"

  filename         = var.lambda_package_path
  source_code_hash = filebase64sha256(var.lambda_package_path)

  memory_size = 256
  timeout     = 30

  environment {
    variables = {
      ENVIRONMENT     = local.environment
      APP_VERSION     = var.app_version
      DB_HOST         = var.db_host
      DB_PORT         = var.db_port
      DB_NAME         = var.db_name
      DB_USER         = var.db_user
      DB_PASSWORD     = var.db_password
      DB_TLS          = "true"
      JWT_SECRET      = random_password.jwt_secret.result
      ALCHEMY_API_KEY = var.alchemy_api_key
      INFURA_API_KEY  = var.infura_api_key
      CMC_API_KEY     = var.cmc_api_key
      CORS_ORIGINS    = "*"
      AUTH_DOMAIN     = local.api_domain
    }
  }
}


# ──────────────────────────────────────────────
# API Gateway HTTP API (replaces Lambda Function URL)
# ──────────────────────────────────────────────
resource "aws_apigatewayv2_api" "api" {
  name          = "waillet-production-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins     = ["*"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers     = ["*"]
    max_age           = 86400
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*"
}

# ──────────────────────────────────────────────
# CloudFront - API (api.waillet.link)
# ──────────────────────────────────────────────
resource "aws_cloudfront_distribution" "api" {
  enabled = true
  aliases = [local.api_domain]
  comment = "waillet API"

  origin {
    domain_name = replace(replace(aws_apigatewayv2_api.api.api_endpoint, "https://", ""), "/", "")
    origin_id   = "api-gateway"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "api-gateway"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # AllViewerExceptHostHeader
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.main.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

# ──────────────────────────────────────────────
# CloudFront - Root domain redirect (waillet.link → GitHub Pages)
# ──────────────────────────────────────────────
resource "aws_cloudfront_function" "redirect" {
  name    = "waillet-redirect-to-github"
  runtime = "cloudfront-js-2.0"
  code    = <<-EOF
    function handler(event) {
      return {
        statusCode: 301,
        statusDescription: 'Moved Permanently',
        headers: {
          location: { value: 'https://ricardocunha.github.io/waillet-mono/' }
        }
      };
    }
  EOF
}

resource "aws_cloudfront_distribution" "redirect" {
  enabled = true
  aliases = [local.domain]
  comment = "waillet redirect to GitHub Pages"

  origin {
    domain_name = "ricardocunha.github.io"
    origin_id   = "github-pages"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "github-pages"
    viewer_protocol_policy = "redirect-to-https"

    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.redirect.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.main.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

# ──────────────────────────────────────────────
# Route53 DNS Records
# ──────────────────────────────────────────────
resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.main.zone_id
  name    = local.api_domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.api.domain_name
    zone_id                = aws_cloudfront_distribution.api.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "root" {
  zone_id = aws_route53_zone.main.zone_id
  name    = local.domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.redirect.domain_name
    zone_id                = aws_cloudfront_distribution.redirect.hosted_zone_id
    evaluate_target_health = false
  }
}

# ──────────────────────────────────────────────
# CloudWatch Log Group
# ──────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/waillet-production-api"
  retention_in_days = 14
}

# ──────────────────────────────────────────────
# Outputs
# ──────────────────────────────────────────────
output "api_url" {
  description = "Production API URL"
  value       = "https://${local.api_domain}"
}

output "api_gateway_url" {
  description = "API Gateway URL (direct)"
  value       = aws_apigatewayv2_api.api.api_endpoint
}

output "nameservers" {
  description = "Set these as nameservers for the domain after registration"
  value       = aws_route53_zone.main.name_servers
}

output "cloudfront_api_domain" {
  description = "CloudFront distribution domain for API"
  value       = aws_cloudfront_distribution.api.domain_name
}