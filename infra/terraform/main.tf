terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}

resource "aws_s3_bucket" "artifacts" {
  bucket = var.artifact_bucket_name
}

resource "aws_dynamodb_table" "sessions" {
  name         = var.session_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sessionId"

  attribute {
    name = "sessionId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "idempotency" {
  name         = var.idempotency_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"

  attribute {
    name = "pk"
    type = "S"
  }
}

resource "aws_sqs_queue" "enrichment" {
  name = var.enrichment_queue_name
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/selfie-data-collector/app"
  retention_in_days = 30
}
