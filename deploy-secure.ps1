# Smart POS - AWS CloudFront HTTPS Security Deployment Script

# Retrieve the latest bucket name from deploy-url.txt
if (-not (Test-Path deploy-url.txt)) {
    Write-Host "No deployment URL found. Please run deploy.ps1 first." -ForegroundColor Red
    exit 1
}

$url = Get-Content deploy-url.txt
# Extract bucket name from URL e.g. http://smart-pos-675254204326-68741.s3-website-us-east-1.amazonaws.com
$bucketName = ($url -replace "http://", "").Split('.')[0]
$originDomain = "$bucketName.s3.amazonaws.com"

Write-Host "Bucket identified: $bucketName" -ForegroundColor Yellow
Write-Host "Origin Domain: $originDomain" -ForegroundColor Yellow

Write-Host "Step 1: Creating AWS CloudFront Distribution (HTTPS SSL wrapper)..." -ForegroundColor Cyan
Write-Host "This will provision an SSL certificate and assign a secure https://*.cloudfront.net link." -ForegroundColor Yellow

# Create distribution and extract domain name & distribution ID
$result = aws cloudfront create-distribution --origin-domain-name $originDomain --default-root-object index.html --output json

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create CloudFront distribution. Make sure AWS CLI is configured." -ForegroundColor Red
    Write-Host $result
    exit 1
}

# Parse JSON result in PowerShell
$distData = $result | ConvertFrom-Json
$cloudfrontDomain = $distData.Distribution.DomainName
$distId = $distData.Distribution.Id

Write-Host "=============================================" -ForegroundColor Green
$secureLink = "https://$cloudfrontDomain"
Write-Host "CloudFront Distribution successfully created!" -ForegroundColor Green
Write-Host "Distribution ID: $distId" -ForegroundColor Yellow
Write-Host "Secure HTTPS Link: $secureLink" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host "Note: AWS CloudFront propagates globally. The HTTPS link will be active in 3-5 minutes." -ForegroundColor Yellow

# Save secure link for reference
$secureLink | Out-File -FilePath secure-url.txt -Encoding utf8
