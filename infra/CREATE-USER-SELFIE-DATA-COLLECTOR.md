# Create IAM user `selfie-data-collector`

Use this to create a dedicated IAM user **selfie-data-collector** (e.g. in account `420795649979`) with deploy permissions, then use it from the CLI.

Use an **admin** profile (one that can create users and attach policies), e.g. the one you use for the account where AgentCoreSpike lives (e.g. `ianturner_4207` or whatever matches that account).

---

## Option 1: AWS CLI (recommended)

Run from the **project root**. Replace `YOUR_ADMIN_PROFILE` with your admin profile (e.g. `ianturner_4207`).

### 1. Create the DeployWebApps policy (if it doesn’t exist yet)

```powershell
aws iam create-policy `
  --policy-name DeployWebApps `
  --policy-document file://infra/iam-policy-deploy-webapps.json `
  --profile YOUR_ADMIN_PROFILE
```

If you get “policy already exists”, skip to step 2.

### 2. Create the user

```powershell
aws iam create-user --user-name selfie-data-collector --profile YOUR_ADMIN_PROFILE
```

### 3. Attach the deploy policy

```powershell
aws iam attach-user-policy `
  --user-name selfie-data-collector `
  --policy-arn "arn:aws:iam::420795649979:policy/DeployWebApps" `
  --profile YOUR_ADMIN_PROFILE
```

(If your account ID is different, replace `420795649979` with your account ID.)

### 4. Create an access key for CLI use

```powershell
aws iam create-access-key --user-name selfie-data-collector --profile YOUR_ADMIN_PROFILE
```

Copy the `AccessKeyId` and `SecretAccessKey` from the output.

### 5. Add a profile to your AWS config

**`~/.aws/credentials`** – add:

```ini
[selfie-data-collector]
aws_access_key_id = PASTE_ACCESS_KEY_ID_HERE
aws_secret_access_key = PASTE_SECRET_ACCESS_KEY_HERE
```

**`~/.aws/config`** – add:

```ini
[profile selfie-data-collector]
region = us-east-1
output = json
```

Use this profile for deploys:

```powershell
$env:AWS_PROFILE = "selfie-data-collector"
# or
aws s3 ls --profile selfie-data-collector
```

---

## Option 2: AWS Console

1. **IAM** → **Users** → **Create user**.
2. **User name:** `selfie-data-collector`. Next.
3. **Permissions:** “Attach policies directly” → create or select **DeployWebApps** (use the JSON from `infra/iam-policy-deploy-webapps.json` if you create it as a custom policy). Next → Create user.
4. Open the new user → **Security credentials** → **Create access key** → use for “Command Line Interface” → create, then copy the key and secret.
5. Add them to `~/.aws/credentials` and add a `[profile selfie-data-collector]` block in `~/.aws/config` as in Option 1, step 5.

---

## Update the policy (admin only)

If Terraform apply fails with `sqs:CreateQueue` or `logs:PutRetentionPolicy` denied, the DeployWebApps policy needs the latest version (SQS + extra CloudWatch actions). From **project root** with an **admin** profile:

```powershell
aws iam create-policy-version --policy-arn arn:aws:iam::420795649979:policy/DeployWebApps --policy-document file://infra/iam-policy-deploy-webapps.json --set-as-default --profile YOUR_ADMIN_PROFILE
```

Then re-run `terraform apply` with the selfie-data-collector profile.

---

## Summary

- **User:** `selfie-data-collector`
- **Policy:** `DeployWebApps` (from `iam-policy-deploy-webapps.json`) – deploy for Lambda, API Gateway, S3, Amplify, ECS/ECR, DynamoDB, Secrets Manager, SSM, CloudFormation, etc.
- **CLI profile:** `selfie-data-collector` (after you add the access key to credentials and config).

After setup, use `--profile selfie-data-collector` (or `AWS_PROFILE=selfie-data-collector`) for this project’s deploys.
