# Smart POS - AWS S3 Static Website Deployment Script

Write-Host "Step 1: Compiling production build..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed. Aborting deployment." -ForegroundColor Red
    exit 1
}

Write-Host "Step 2: Generating unique S3 Bucket name..." -ForegroundColor Cyan
# Retrieve AWS Account ID to ensure uniqueness
$accountId = (aws sts get-caller-identity --query Account --output text).Trim()
$randomSuffix = Get-Random -Minimum 10000 -Maximum 99999
$bucketName = "smart-pos-$accountId-$randomSuffix"
$region = "us-east-1"

Write-Host "Selected Bucket Name: $bucketName in Region: $region" -ForegroundColor Yellow

Write-Host "Step 3: Creating S3 Bucket..." -ForegroundColor Cyan
aws s3 mb s3://$bucketName --region $region
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create bucket. Aborting." -ForegroundColor Red
    exit 1
}

Write-Host "Step 4: Configuring static website hosting..." -ForegroundColor Cyan
aws s3api put-bucket-website --bucket $bucketName --website-configuration '{"IndexDocument":{"Suffix":"index.html"},"ErrorDocument":{"Suffix":"index.html"}}'

Write-Host "Step 5: Disabling 'Block Public Access' policies..." -ForegroundColor Cyan
aws s3api put-public-access-block --bucket $bucketName --public-access-block-configuration "BlockPublicAccess=false,IgnorePublicAcls=false,BlockPublicAcls=false,RestrictPublicBuckets=false"

Write-Host "Step 6: Creating policy JSON file..." -ForegroundColor Cyan
$policyJson = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$bucketName/*"
    }
  ]
}
"@
$policyJson | Out-File -FilePath temp_policy.json -Encoding utf8

Write-Host "Step 7: Applying public-read policy to S3 bucket..." -ForegroundColor Cyan
aws s3api put-bucket-policy --bucket $bucketName --policy file://temp_policy.json

# Clean up temp policy file
Remove-Item temp_policy.json -Force -ErrorAction SilentlyContinue

Write-Host "Step 8: Uploading assets to S3 (syncing dist/)..." -ForegroundColor Cyan
aws s3 sync dist/ s3://$bucketName/ --acl public-read

Write-Host "=============================================" -ForegroundColor Green
$endpoint = "http://$bucketName.s3-website-$region.amazonaws.com"
Write-Host "Smart POS is successfully deployed to AWS!" -ForegroundColor Green
Write-Host "Working Link: $endpoint" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# Save endpoint for reference
$endpoint | Out-File -FilePath deploy-url.txt -Encoding utf8
