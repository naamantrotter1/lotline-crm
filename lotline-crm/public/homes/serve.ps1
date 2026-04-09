$port = if ($env:PORT) { $env:PORT } else { "3000" }
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
[Console]::WriteLine("Server running at http://localhost:$port/")
[Console]::Out.Flush()

$root = "C:\Users\naama\LotLine Homes Dealership"

$mimeTypes = @{
  ".html" = "text/html"
  ".css"  = "text/css"
  ".js"   = "application/javascript"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
  ".json" = "application/json"
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response

  $path = $req.Url.LocalPath
  if ($path -eq "/") { $path = "/index.html" }

  $filePath = Join-Path $root $path.TrimStart("/")

  if (Test-Path $filePath -PathType Leaf) {
    $ext = [System.IO.Path]::GetExtension($filePath)
    $mime = $mimeTypes[$ext]
    if (-not $mime) { $mime = "application/octet-stream" }
    $res.ContentType = $mime
    $bytes = [System.IO.File]::ReadAllBytes($filePath)
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $res.StatusCode = 404
    $msg = [System.Text.Encoding]::UTF8.GetBytes("Not found")
    $res.OutputStream.Write($msg, 0, $msg.Length)
  }

  $res.OutputStream.Close()
}
