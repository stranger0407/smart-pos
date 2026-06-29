# Smart POS - GitHub Repository Setup Script

Write-Host "Configuring Git branch naming..." -ForegroundColor Cyan
git branch -m main

Write-Host "Staging codebase files..." -ForegroundColor Cyan
git add .

Write-Host "Creating initial commit..." -ForegroundColor Cyan
git commit -m "Initial commit: Smart POS Local-First Retail Management System"

# Try creating repository 'smart-pos'
$repoName = "smart-pos"
Write-Host "Creating public GitHub repository: $repoName ..." -ForegroundColor Cyan

# Execute gh repo create
$createResult = gh repo create $repoName --public --source=. --remote=origin --push 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Repository '$repoName' might already exist or failed to create. Trying fallback name..." -ForegroundColor Yellow
    
    # Try removing existing remote if any
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
