# Terraform — Selfie Data Collector (Single AWS Env)

Creates all AWS resources for the app using the **DeployWebApps** policy.

## Prerequisites

1. Create the IAM user and attach the policy (one-time):
   - From repo root: [CREATE-USER-SELFIE-DATA-COLLECTOR.md](../CREATE-USER-SELFIE-DATA-COLLECTOR.md)
   - Policy document: [iam-policy-deploy-webapps.json](../iam-policy-deploy-webapps.json)

2. Configure the CLI profile `selfie-data-collector` in `~/.aws/credentials` and `~/.aws/config`.

## Usage

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars: set artifact_bucket_name (must be globally unique)

terraform init
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

By default the provider uses `aws_profile = "selfie-data-collector"`, so all resources are created with that identity (DeployWebApps policy). Override with `-var="aws_profile=OTHER"` if needed.

## Outputs

After apply, use the outputs for app config:

- `artifact_bucket` → `S3_ARTIFACT_BUCKET`
- `session_table` → `DYNAMODB_SESSION_TABLE`
- `idempotency_table` → `DYNAMODB_IDEMPOTENCY_TABLE`
- `enrichment_queue_url` → `ENRICHMENT_QUEUE_URL`
