output "artifact_bucket" {
  value = aws_s3_bucket.artifacts.bucket
}

output "session_table" {
  value = aws_dynamodb_table.sessions.name
}

output "idempotency_table" {
  value = aws_dynamodb_table.idempotency.name
}

output "enrichment_queue_url" {
  value = aws_sqs_queue.enrichment.url
}
