# Grant deploy permissions to `ian-genui`

To deploy web apps (APIs, dashboards, ECS, Lambda, S3, etc.) from the CLI using the **ian-genui** profile, attach the policy in this folder to the IAM user (or role) that profile uses.

If that identity doesn’t have IAM permissions, use **root** or another **IAM user/role with IAM rights** (e.g. `AdministratorAccess` or `IAMFullAccess`) to create and attach the policy.

---

## Get your ian-genui identity

From the project root:

```powershell
aws sts get-caller-identity --profile ian-genui
```

Note the **Account** and, from **Arn**, the user name (e.g. `arn:aws:iam::123456789012:user/YourUserName` → user name is `YourUserName`). Use these below.

---

## Option A: AWS Console (root or admin user)

1. Sign in to the AWS Console as **root** or an admin IAM user (for the same account as ian-genui).
2. Open **IAM** → **Users** → **&lt;your ian-genui IAM user name&gt;**.
3. **Add permissions** → **Create inline policy** (or **Attach policies** if you prefer a managed policy).
4. For inline: **JSON** tab, paste the contents of `iam-policy-deploy-webapps.json`, then **Review** → name it e.g. `DeployWebApps` → **Create policy**.
5. Done. Use the CLI with `--profile ian-genui` (or set `AWS_PROFILE=ian-genui`) to deploy.

---

## Option B: AWS CLI (admin profile)

If you have a CLI profile with IAM rights for the same account (e.g. root or another admin user), run from the project directory. Replace `ACCOUNT_ID` and `IAN_GENUI_USER_NAME` with the values from `aws sts get-caller-identity --profile ian-genui` (Account and the user name from Arn).

PowerShell:

```powershell
# Create the policy
aws iam create-policy `
  --policy-name DeployWebApps `
  --policy-document file://infra/iam-policy-deploy-webapps.json `
  --profile YOUR_ADMIN_PROFILE

# Attach to the ian-genui IAM user
aws iam attach-user-policy `
  --user-name IAN_GENUI_USER_NAME `
  --policy-arn "arn:aws:iam::ACCOUNT_ID:policy/DeployWebApps" `
  --profile YOUR_ADMIN_PROFILE
```

Cmd:

```bash
aws iam create-policy ^
  --policy-name DeployWebApps ^
  --policy-document file://infra/iam-policy-deploy-webapps.json ^
  --profile YOUR_ADMIN_PROFILE

aws iam attach-user-policy ^
  --user-name IAN_GENUI_USER_NAME ^
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/DeployWebApps ^
  --profile YOUR_ADMIN_PROFILE
```

Replace `YOUR_ADMIN_PROFILE` with the profile that has IAM permissions. If ian-genui is already an admin, you can use `--profile ian-genui` and the same user name for both steps.

---

## What this policy allows

- **Lambda** – create/update/delete functions, invoke, list (serverless APIs).
- **API Gateway** – create and manage REST/HTTP APIs.
- **S3** – buckets and objects (static sites, artifacts, data).
- **Amplify** – host and deploy frontends/dashboards.
- **CloudFormation** – deploy stacks (SAM, CDK, raw CFN).
- **ECS & ECR** – run containers (Fargate), push images (for your data-collector service).
- **DynamoDB** – tables for session state and metadata.
- **Secrets Manager & SSM** – secrets and config (e.g. Telegram token, Bedrock).
- **IAM PassRole** – for Lambda and ECS task roles.
- **CloudWatch Logs** – log groups for Lambda/ECS.

After attaching, use **`--profile ian-genui`** (or `AWS_PROFILE=ian-genui`) for all deploy and AWS CLI commands.
