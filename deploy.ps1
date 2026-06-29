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
$websiteJson = '{"IndexDocument":{"Suffix":"index.html"},"ErrorDocument":{"Key":"index.html"}}'
[System.IO.File]::WriteAllText("temp_website.json", $websiteJson)
aws s3api put-bucket-website --bucket $bucketName --website-configuration file://temp_website.json
Remove-Item temp_website.json -Force -ErrorAction SilentlyContinue

Write-Host "Step 5: Disabling 'Block Public Access' policies..." -ForegroundColor Cyan
aws s3api put-public-access-block --bucket $bucketName --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

Write-Host "Step 6: Creating policy JSON file (No BOM)..." -ForegroundColor Cyan
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
[System.IO.File]::WriteAllText("temp_policy.json", $policyJson)

Write-Host "Step 7: Applying public-read policy to S3 bucket..." -ForegroundColor Cyan
aws s3api put-bucket-policy --bucket $bucketName --policy file://temp_policy.json
Remove-Item temp_policy.json -Force -ErrorAction SilentlyContinue

Write-Host "Step 8: Uploading assets to S3 (syncing dist/)..." -ForegroundColor Cyan
# Sync without --acl public-read since Bucket Owner Enforced disables ACLs (public-read bucket policy handles the access)
aws s3 sync dist/ s3://$bucketName/

Write-Host "=============================================" -ForegroundColor Green
$endpoint = "http://$bucketName.s3-website-$region.amazonaws.com"
Write-Host "Smart POS is successfully deployed to AWS!" -ForegroundColor Green
Write-Host "Working Link: $endpoint" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# Save endpoint for reference
$endpoint | Out-File -FilePath deploy-url.txt -Encoding utf8
