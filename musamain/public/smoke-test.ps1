# smoke-test.ps1 — Musalingo server smoke test
$ErrorActionPreference = "Stop"
$base = "http://localhost:3000"

function Test-Status {
    param($Uri, $Expected, $Method = "GET", $Body = $null)
    try {
        if ($Body) {
            $r = Invoke-WebRequest -Uri $Uri -Method $Method -Body $Body -ContentType "application/json" -UseBasicParsing
        }
        else {
            $r = Invoke-WebRequest -Uri $Uri -Method $Method -UseBasicParsing
        }
        $code = [int]$r.StatusCode
        $content = $r.Content
    }
    catch {
        $response = $_.Exception.Response
        if (-not $response) {
            throw "Request failed for $Uri; is the server running? $($_.Exception.Message)"
        }

        $code = [int]$response.StatusCode
        if ($response -is [System.Net.Http.HttpResponseMessage]) {
            $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        }
        else {
            $stream = $response.GetResponseStream()
            if ($stream) {
                $reader = New-Object System.IO.StreamReader($stream)
                $content = $reader.ReadToEnd()
                $reader.Dispose()
            }
            else {
                $content = ""
            }
        }
    }
    if ($code -ne $Expected) { throw "Expected $Expected, got $code for $Uri" }
    return $content
}

Write-Host "1. .env not public..." -ForegroundColor Cyan
Test-Status -Uri "$base/.env" -Expected 404 | Out-Null
Write-Host "   PASS (404)" -ForegroundColor Green

Write-Host "2. Firebase config..." -ForegroundColor Cyan
$json = Test-Status -Uri "$base/api/firebase-config" -Expected 200 | ConvertFrom-Json
if (-not $json.apiKey -or -not $json.projectId -or -not $json.appId) { throw "firebase-config incomplete" }
Write-Host "   PASS" -ForegroundColor Green

Write-Host "3. Dashboard serves..." -ForegroundColor Cyan
Test-Status -Uri "$base/dashboard.html" -Expected 200 | Out-Null
Write-Host "   PASS" -ForegroundColor Green

Write-Host "4. Gemini generates questions..." -ForegroundColor Cyan
$body = '{"language":"Spanish","topic":"greetings","count":3,"level":1}'
$raw = Test-Status -Uri "$base/api/generate-questions" -Expected 200 -Method POST -Body $body
$questions = $raw | ConvertFrom-Json
if (-not $questions -or $questions.Count -lt 1) { throw "no questions returned" }
$firstHint = $questions[0].hint
if ($firstHint -match "Practice .* words\.") {
    Write-Host "   WARNING: fallback detected" -ForegroundColor Yellow
}
else {
    Write-Host "   PASS (real AI: '$firstHint')" -ForegroundColor Green
}

Write-Host "5. Chess chat..." -ForegroundColor Cyan
$chatBody = '{"prompt":"What is the best first move in chess?"}'
$chatRaw = Test-Status -Uri "$base/api/chat" -Expected 200 -Method POST -Body $chatBody
$chatJson = $chatRaw | ConvertFrom-Json
if (-not $chatJson.text) { throw "chat reply missing" }
Write-Host "   PASS" -ForegroundColor Green

Write-Host ""
Write-Host "ALL SMOKE TESTS PASSED" -ForegroundColor Green