param(
  [Parameter(Mandatory = $true)][string]$SegmentDirectory,
  [Parameter(Mandatory = $true)][string]$OutputPath
)

Add-Type -AssemblyName System.Drawing

$meta = Get-Content -LiteralPath (Join-Path $SegmentDirectory 'meta.json') -Raw | ConvertFrom-Json
$canvas = New-Object System.Drawing.Bitmap([int]$meta.width, [int]$meta.height)
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$graphics.Clear([System.Drawing.Color]::White)

try {
  $coveredUntil = 0
  for ($index = 0; $index -lt $meta.tops.Count; $index++) {
    $sourcePath = Join-Path $SegmentDirectory (('{0:d2}.png' -f $index))
    $source = [System.Drawing.Image]::FromFile($sourcePath)
    try {
      $top = [int]$meta.tops[$index]
      $sourceY = [Math]::Max(0, $coveredUntil - $top)
      $destinationY = $top + $sourceY
      $remainingCanvas = [int]$meta.height - $destinationY
      $drawHeight = [Math]::Min($source.Height - $sourceY, $remainingCanvas)
      if ($drawHeight -le 0) { continue }

      $sourceRect = New-Object System.Drawing.Rectangle(0, $sourceY, $source.Width, $drawHeight)
      $destinationRect = New-Object System.Drawing.Rectangle(0, $destinationY, $source.Width, $drawHeight)
      $graphics.DrawImage($source, $destinationRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
      $coveredUntil = [Math]::Max($coveredUntil, $destinationY + $drawHeight)
    }
    finally {
      $source.Dispose()
    }
  }

  $canvas.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
  $graphics.Dispose()
  $canvas.Dispose()
}
