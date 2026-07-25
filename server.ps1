$port = 8085
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)
$listener.Start()
Write-Host "Bevasarlo Lista webszerver fut a http://192.168.0.237:$port es http://localhost:$port cimen"

$currentDir = Get-Location

while ($true) {
    $client = $listener.AcceptTcpClient()
    $stream = $client.GetStream()
    $reader = [System.IO.StreamReader]::new($stream)
    $writer = [System.IO.StreamWriter]::new($stream)
    
    $requestLine = $reader.ReadLine()
    if ($requestLine) {
        $tokens = $requestLine.Split(' ')
        if ($tokens.Length -ge 2) {
            $urlPath = $tokens[1]
            if ($urlPath -eq '/' -or [string]::IsNullOrWhiteSpace($urlPath)) { $urlPath = '/index.html' }
            
            # Remove query string if any
            if ($urlPath.Contains('?')) {
                $urlPath = $urlPath.Substring(0, $urlPath.IndexOf('?'))
            }
            
            $filePath = Join-Path $currentDir $urlPath
            
            if (Test-Path $filePath -PathType Leaf) {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                
                $contentType = "text/html; charset=utf-8"
                if ($filePath.EndsWith('.css')) { $contentType = "text/css; charset=utf-8" }
                elseif ($filePath.EndsWith('.js')) { $contentType = "application/javascript; charset=utf-8" }
                
                $header = "HTTP/1.1 200 OK`r`nContent-Type: $contentType`r`nContent-Length: $($bytes.Length)`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
                $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($header)
                
                $stream.Write($headerBytes, 0, $headerBytes.Length)
                $stream.Write($bytes, 0, $bytes.Length)
            } else {
                $notFound = "HTTP/1.1 404 Not Found`r`nContent-Length: 0`r`nConnection: close`r`n`r`n"
                $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes($notFound)
                $stream.Write($notFoundBytes, 0, $notFoundBytes.Length)
            }
        }
    }
    
    $writer.Flush()
    $client.Close()
}
