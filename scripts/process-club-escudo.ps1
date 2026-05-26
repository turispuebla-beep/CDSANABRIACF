# Genera escudos del club desde assets/ESTE.png (o el primer PNG encontrado)
$ErrorActionPreference = 'Stop'
$root = if ($PSScriptRoot) { Split-Path $PSScriptRoot -Parent } else { 'C:\Users\marsa\Desktop\CDSANABRIACF1' }
$assets = Join-Path $root 'assets'
$src = Join-Path $assets 'ESTE.png'
if (-not (Test-Path $src)) {
    $src = Get-ChildItem $assets -Filter '*.png' | Where-Object { $_.Name -ne 'escudo-192.png' } | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $src) { throw 'No hay PNG fuente en assets/' }

Add-Type -AssemblyName System.Drawing

function New-BitmapFromFile([string]$path) {
    return [System.Drawing.Bitmap]::FromFile($path)
}

function MakeTransparentOutside([System.Drawing.Bitmap]$bmp) {
    $w = $bmp.Width
    $h = $bmp.Height
    $visited = New-Object 'bool[]' ($w * $h)
    $queue = [System.Collections.Generic.Queue[int]]::new()

    function Get-Idx([int]$x, [int]$y) { return ($y * $w) + $x }
    function IsBg($c) {
        return $c.A -lt 10 -or ($c.R -gt 248 -and $c.G -gt 248 -and $c.B -gt 248)
    }
    function Enqueue($x, $y) {
        $i = Get-Idx $x $y
        if ($x -ge 0 -and $y -ge 0 -and $x -lt $w -and $y -lt $h -and -not $visited[$i]) {
            $c = $bmp.GetPixel($x, $y)
            if (IsBg $c) {
                $visited[$i] = $true
                $queue.Enqueue($i) | Out-Null
            }
        }
    }

    for ($x = 0; $x -lt $w; $x++) {
        Enqueue $x 0
        Enqueue $x ($h - 1)
    }
    for ($y = 0; $y -lt $h; $y++) {
        Enqueue 0 $y
        Enqueue ($w - 1) $y
    }

    while ($queue.Count -gt 0) {
        $i = $queue.Dequeue()
        $x = $i % $w
        $y = [int][math]::Floor($i / $w)
        Enqueue ($x + 1) $y
        Enqueue ($x - 1) $y
        Enqueue $x ($y + 1)
        Enqueue $x ($y - 1)
    }

    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            $idx = Get-Idx $x $y
            if ($visited[$idx]) {
                $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
            }
        }
    }
    return $bmp
}

function Resize-Png([System.Drawing.Image]$source, [int]$size, [string]$dest) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $bmp.SetResolution($source.HorizontalResolution, $source.VerticalResolution)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($source, 0, 0, $size, $size)
    $g.Dispose()
    $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

Write-Host "Fuente: $src"
$raw = New-BitmapFromFile $src
Write-Host "Tamano original: $($raw.Width)x$($raw.Height)"

$processed = New-Object System.Drawing.Bitmap $raw.Width, $raw.Height
$processed.SetResolution($raw.HorizontalResolution, $raw.VerticalResolution)
$g0 = [System.Drawing.Graphics]::FromImage($processed)
$g0.DrawImage($raw, 0, 0)
$g0.Dispose()
$raw.Dispose()

$processed = MakeTransparentOutside $processed

$sizes = @{
    'escudo-512.png'           = 512
    'escudo-192.png'           = 192
    'escudo-180.png'           = 180
    'escudo-cdsanabriacf.png'  = 400
}

foreach ($name in $sizes.Keys) {
    $dest = Join-Path $assets $name
    Resize-Png $processed $sizes[$name] $dest
    Write-Host "  + $name ($($sizes[$name])px)"
}

$processed.Dispose()
Write-Host 'Listo. Ejecuta build-netlify-dist.ps1 para copiar a netlify-dist.'
