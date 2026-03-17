variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "us-east-1"
}

variable "aws_profile" {
  type        = string
  description = "AWS CLI profile used to create/manage resources (should have DeployWebApps policy)"
  default     = "selfie-data-collector"
}

variable "artifact_bucket_name" {
  type        = string
  description = "S3 bucket name for artifacts"
}

variable "session_table_name" {
  type        = string
  description = "DynamoDB table name for A3 sessions"
  default     = "selfie-collector-sessions"
}

variable "idempotency_table_name" {
  type        = string
  description = "DynamoDB table name for idempotency keys"
  default     = "selfie-collector-idempotency"
}

variable "enrichment_queue_name" {
  type        = string
  description = "SQS queue for enrichment jobs"
  default     = "selfie-collector-enrichment"
}
