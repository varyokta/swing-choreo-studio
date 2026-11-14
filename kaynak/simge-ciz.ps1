# Uygulama simgesini çizer: koyu kahve zemin üstünde 5 6 7 8 sayım kareleri, retro renklerde (hardal, kiremit, yeşil, bordo).
# Kullanım (PowerShell): .\kaynak\simge-ciz.ps1   -> docs\simgeler\simge-180/192/512.png
Add-Type -AssemblyName System.Drawing
$hedef = Join-Path (Split-Path $PSScriptRoot -Parent) 'docs\simgeler'
New-Item -ItemType Directory -Force $hedef | Out-Null

function Renk($hex) { return [System.Drawing.ColorTranslator]::FromHtml($hex) }

function Yuvarlak($g, $firca, $x, $y, $w, $h, $r) {
  $yol = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $yol.AddArc($x, $y, $d, $d, 180, 90)
  $yol.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $yol.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $yol.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $yol.CloseFigure()
  $g.FillPath($firca, $yol)
  $yol.Dispose()
}

foreach ($boyut in 180, 192, 512) {
  $bmp = New-Object System.Drawing.Bitmap $boyut, $boyut
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear((Renk '#1A1310'))
  # maskeli simgeler için içerik ortadaki %66'lık alanda
  $alan = $boyut * 0.66
  $bosluk = $alan * 0.08
  $kare = ($alan - $bosluk) / 2
  $x0 = ($boyut - $alan) / 2
  $y0 = ($boyut - $alan) / 2
  $yazi = New-Object System.Drawing.Font('Segoe UI', ($kare * 0.52), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $bicim = New-Object System.Drawing.StringFormat
  $bicim.Alignment = 'Center'; $bicim.LineAlignment = 'Center'
  $sayilar = '5', '6', '7', '8'
  for ($i = 0; $i -lt 4; $i++) {
    $x = $x0 + ($i % 2) * ($kare + $bosluk)
    $y = $y0 + [math]::Floor($i / 2) * ($kare + $bosluk)
    $son = ($i -eq 3)
    $zemin = New-Object System.Drawing.SolidBrush (Renk (@('#E0A82E', '#C65A33', '#3E7D52', '#8C2335')[$i]))
    Yuvarlak $g $zemin $x $y $kare $kare ($kare * 0.18)
    $kalem = New-Object System.Drawing.SolidBrush (Renk (@('#2A1D17', '#FFF6E6', '#FFF6E6', '#FFF6E6')[$i]))
    $g.DrawString($sayilar[$i], $yazi, $kalem, (New-Object System.Drawing.RectangleF($x, ($y + $kare * 0.02), $kare, $kare)), $bicim)
    $zemin.Dispose(); $kalem.Dispose()
  }
  $dosya = Join-Path $hedef "simge-$boyut.png"
  $bmp.Save($dosya, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "yazıldı: $dosya"
}
