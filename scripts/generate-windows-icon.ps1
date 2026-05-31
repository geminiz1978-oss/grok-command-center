param(
  [string]$SourcePng = "resources/grok-command-center-icon.png",
  [string]$OutputIco = "resources/grok-command-center-icon.ico"
)

Add-Type -AssemblyName System.Drawing

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$source = [System.Drawing.Image]::FromFile((Resolve-Path $SourcePng))

try {
  $side = [Math]::Min($source.Width, $source.Height)
  $cropX = [Math]::Floor(($source.Width - $side) / 2)
  $cropY = [Math]::Floor(($source.Height - $side) / 2)
  $crop = New-Object System.Drawing.Rectangle($cropX, $cropY, $side, $side)
  $entries = New-Object System.Collections.Generic.List[object]

  foreach ($size in $sizes) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    try {
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.DrawImage($source, (New-Object System.Drawing.Rectangle(0, 0, $size, $size)), $crop, [System.Drawing.GraphicsUnit]::Pixel)

      $stream = New-Object System.IO.MemoryStream
      $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
      $entries.Add([PSCustomObject]@{
        Size = $size
        Bytes = $stream.ToArray()
      })
    } finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  }

  $outputPath = Join-Path (Get-Location) $OutputIco
  $directory = Split-Path $outputPath -Parent
  if (!(Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory | Out-Null
  }

  $file = [System.IO.File]::Create($outputPath)
  $writer = New-Object System.IO.BinaryWriter($file)

  try {
    $writer.Write([UInt16]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]$entries.Count)

    $offset = 6 + (16 * $entries.Count)

    foreach ($entry in $entries) {
      $writer.Write([byte]($(if ($entry.Size -eq 256) { 0 } else { $entry.Size })))
      $writer.Write([byte]($(if ($entry.Size -eq 256) { 0 } else { $entry.Size })))
      $writer.Write([byte]0)
      $writer.Write([byte]0)
      $writer.Write([UInt16]1)
      $writer.Write([UInt16]32)
      $writer.Write([UInt32]$entry.Bytes.Length)
      $writer.Write([UInt32]$offset)
      $offset += $entry.Bytes.Length
    }

    foreach ($entry in $entries) {
      $writer.Write($entry.Bytes)
    }
  } finally {
    $writer.Dispose()
    $file.Dispose()
  }
} finally {
  $source.Dispose()
}

Write-Host "Generated $OutputIco"
