param(
  [Parameter(Mandatory = $true)]
  [string]$CommitMessage,

  [string]$RepoDir = "C:\Users\iantu\side_projects\selfie-data-collector",
  [string]$MainBranch = "main",

  [string]$SshUser = "ec2-user",
  [string]$Ec2Host = "ec2-3-88-220-252.compute-1.amazonaws.com",
  [string]$KeyPath = "C:\Users\iantu\side_projects\selfie-data-collector\selfie-shared-key.pem",

  [string]$RemoteDir = "~/selfie-collector",

  [string]$BuildTag = "selfie-app:build",
  [string]$LatestTag = "selfie-app:latest",

  [switch]$NoCache,

  # If set, copies your local .env to EC2 before starting the container.
  # By default, this assumes the EC2 machine already has a correct ~/.env at $RemoteDir/.env
  [switch]$CopyEnvToEc2,

  # If set, does not delete the local tar file after deploy.
  [switch]$KeepTar
)

$ErrorActionPreference = "Stop"

function Assert-File([string]$path, [string]$label) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "$label not found: $path"
  }
}

Assert-File $RepoDir "RepoDir"
Assert-File $KeyPath "SSH KeyPath"

$envFilePath = Join-Path $RepoDir ".env"
if ($CopyEnvToEc2) {
  Assert-File $envFilePath ".env"
}

$tarDir = $PSScriptRoot
if (-not (Test-Path -LiteralPath $tarDir)) {
  New-Item -ItemType Directory -Path $tarDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$tarName = "selfie-app-build-$timestamp.tar"
$tarPathLocal = Join-Path $tarDir $tarName
$tarPathRemote = "~/$tarName"

function Run($command, $cmdArgs) {
  & $command @cmdArgs
  if ($LASTEXITCODE -ne 0) {
    throw "$command failed with exit code $LASTEXITCODE"
  }
}

Write-Host "==> [1/6] Git: add/commit/push ($MainBranch)" -ForegroundColor Cyan
Push-Location $RepoDir

Run "git" @("add", "-A")

& git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-Host "No staged changes to commit. Skipping git commit/push." -ForegroundColor Yellow
} else {
  Run "git" @("commit", "-m", $CommitMessage)
  Run "git" @("push", "origin", $MainBranch)
}

Pop-Location

Write-Host "==> [2/6] Docker build ($BuildTag)" -ForegroundColor Cyan
Push-Location $RepoDir
if ($NoCache) {
  Run "docker" @("build", "--progress=plain", "--no-cache", "-t", $BuildTag, ".")
} else {
  Run "docker" @("build", "--progress=plain", "-t", $BuildTag, ".")
}
Pop-Location

Write-Host "==> [3/6] docker save -> $tarPathLocal" -ForegroundColor Cyan
Run "docker" @("save", $BuildTag, "-o", $tarPathLocal)

if ($CopyEnvToEc2) {
  Write-Host "==> [3.5/6] scp .env to EC2" -ForegroundColor Cyan
  $scpDestEnv = "${SshUser}@${Ec2Host}:${RemoteDir}/.env"
  Run "scp" @("-i", $KeyPath, $envFilePath, $scpDestEnv)
}

Write-Host "==> [4/6] scp image tar -> EC2" -ForegroundColor Cyan
$scpDestTar = "${SshUser}@${Ec2Host}:${tarPathRemote}"
Run "scp" @("-i", $KeyPath, $tarPathLocal, $scpDestTar)

Write-Host "==> [5/6] ssh: docker load + restart container" -ForegroundColor Cyan
$remoteCmd = @"
set -e
echo "Docker load: $tarPathRemote"
sudo docker load -i $tarPathRemote

echo "Stop/remove existing container (if any)"
sudo docker stop selfie-app 2>/dev/null || true
sudo docker rm selfie-app 2>/dev/null || true

echo "Tag $BuildTag -> $LatestTag"
sudo docker tag $BuildTag $LatestTag 2>/dev/null || true

echo "Start selfie-app ($LatestTag)"
sudo docker run -d --name selfie-app -p 3000:3000 --env-file $RemoteDir/.env --restart unless-stopped $LatestTag

echo "Container status:"
sudo docker ps --format "{{.Names}}  {{.Image}}  {{.Status}}" | head -n 5
"@

Run "ssh" @("-i", $KeyPath, "${SshUser}@${Ec2Host}", $remoteCmd)

Write-Host "==> [6/6] Cleanup" -ForegroundColor Cyan
if (-not $KeepTar) {
  Remove-Item -LiteralPath $tarPathLocal -Force -ErrorAction SilentlyContinue | Out-Null

  # Optional: remove tar from EC2 to save space
  try {
    Run "ssh" @("-i", $KeyPath, "$SshUser@$Ec2Host", "rm -f $tarPathRemote")
  } catch {
    # ignore cleanup failures
  }
}

Write-Host "Deploy complete." -ForegroundColor Green

