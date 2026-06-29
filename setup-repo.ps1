# Smart POS - GitHub Repository Setup Script

# Clear invalid environment token to allow fallback to keyring
$env:GITHUB_TOKEN = $null

Write-Host "Configuring Git branch naming..." -ForegroundColor Cyan
git branch -m main 2>$null

Write-Host "Staging codebase files..." -ForegroundColor Cyan
git add .

# Check if there are changes to commit
$status = git status --porcelain
if ($status) {
    Write-Host "Creating git commit..." -ForegroundColor Cyan
    git commit -m "Initial commit: Smart POS Local-First Retail Management System"
} else {
    Write-Host "No changes to commit. Proceeding..." -ForegroundColor Yellow
}

# Try creating repository 'smart-pos'
$repoName = "smart-pos"
Write-Host "Creating public GitHub repository: $repoName ..." -ForegroundColor Cyan

# Remove existing remote if any prior run left it
git remote remove origin 2>$null

# Execute gh repo create
$createResult = gh repo create $repoName --public --source=. --remote=origin --push 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Repository '$repoName' might already exist or failed to create. Trying fallback name..." -ForegroundColor Yellow
    
    # Try removing remote
    git remote remove origin 2>$null
    
    $fallbackName = "smart-pos-terminal"
    Write-Host "Creating public GitHub repository: $fallbackName ..." -ForegroundColor Cyan
    
    $createResult = gh repo create $fallbackName --public --source=. --remote=origin --push 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Fallback repository failed as well. Error details:" -ForegroundColor Red
        Write-Host $createResult
        exit 1
    } else {
        Write-Host "Successfully created and pushed repository: $fallbackName" -ForegroundColor Green
    }
} else {
    Write-Host "Successfully created and pushed repository: $repoName" -ForegroundColor Green
}
