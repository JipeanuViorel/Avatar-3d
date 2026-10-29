# ==============================================================================
# Proiect Grafică pe Calculator - Student: Jipeanu Viorel
# Server HTTP Static Local în PowerShell (fără dependențe externe)
# ==============================================================================

$port = 8080
$prefix = "http://localhost:$port/"
$rootPath = $PSScriptRoot

Write-Host "Pornire server local WebGL pe: $prefix" -ForegroundColor Yellow

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Host "Portul $port este ocupat. Se foloseste portul 8081..." -ForegroundColor Yellow
    $port = 8081
    $prefix = "http://localhost:$port/"
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($prefix)
    $listener.Start()
}

Write-Host "Serverul ruleaza cu succes!" -ForegroundColor Green
Write-Host "Se deschide automat browserul la adresa $prefix ..." -ForegroundColor Cyan
Write-Host "Apasati Ctrl+C in aceasta fereastra pentru a opri serverul.`n" -ForegroundColor Gray
Start-Process $prefix

# Dicționar tipuri MIME
$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".glb"  = "model/gltf-binary"
    ".gltf" = "model/gltf+json"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
}


while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    # Permisiune CORS pentru integrare flexibilă
    $response.Headers.Add("Access-Control-Allow-Origin", "*")
    $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $response.Headers.Add("Access-Control-Allow-Headers", "*")

    if ($request.HttpMethod -eq "OPTIONS") {
        $response.StatusCode = 200
        $response.Close()
        continue
    }

    $rawUrl = $request.Url.LocalPath
    if ($rawUrl -eq "/" -or [string]::IsNullOrEmpty($rawUrl)) {
        $rawUrl = "/index.html"
    }

    $filePath = [System.IO.Path]::Combine($rootPath, $rawUrl.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar))

    if ([System.IO.File]::Exists($filePath)) {
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }

        $response.ContentType = $contentType
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
        $response.StatusCode = 200
    } else {
        $response.StatusCode = 404
        $notFoundMsg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $rawUrl")
        $response.OutputStream.Write($notFoundMsg, 0, $notFoundMsg.Length)
    }

    $response.Close()
}
