Add-Type -AssemblyName System.Drawing

function New-RoundedPath([int]$x, [int]$y, [int]$width, [int]$height, [int]$radius) {
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $diameter = $radius * 2
    $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
    $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
    $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

$assetDirectory = Join-Path (Split-Path -Parent $PSScriptRoot) 'assets'
$canvas = [System.Drawing.Bitmap]::new(512, 512)
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

$navy = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#101E34'))
$metal = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#21476F'))
$screen = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#0B1B30'))
$paleBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#CDE9FF'))
$blueBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#75BCFF'))
$glassBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#245686'))
$blue = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#75BCFF'), 17)
$arm = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#438EDF'), 21)
$lens = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#9AD3FF'), 28)
$handle = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#A8D9FF'), 32)
foreach ($pen in @($blue, $arm, $lens, $handle)) {
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
}

$backgroundPath = New-RoundedPath 8 8 496 496 96
$graphics.FillPath($navy, $backgroundPath)
$graphics.DrawLine($blue, 187, 127, 187, 151)
$graphics.FillEllipse($blueBrush, 170, 92, 34, 34)
$graphics.FillEllipse($metal, 44, 228, 48, 88)
$graphics.FillEllipse($metal, 285, 228, 45, 88)
$headPath = New-RoundedPath 62 149 251 244 65
$graphics.FillPath($metal, $headPath)
$graphics.DrawPath($blue, $headPath)
$facePath = New-RoundedPath 99 194 177 129 34
$graphics.FillPath($screen, $facePath)
$graphics.FillEllipse($paleBrush, 134, 240, 32, 32)
$graphics.FillEllipse($paleBrush, 222, 240, 32, 32)
$graphics.DrawArc($blue, 156, 262, 75, 48, 20, 140)
$graphics.FillRectangle($metal, 135, 390, 105, 45)
$graphics.DrawLine($arm, 270, 362, 285, 419)
$graphics.DrawLine($handle, 285, 419, 338, 368)
$graphics.FillEllipse($blueBrush, 266, 400, 38, 38)
$graphics.FillEllipse($glassBrush, 310, 220, 172, 172)
$graphics.DrawEllipse($lens, 310, 220, 172, 172)
$letterFont = [System.Drawing.Font]::new('Arial', 106, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$letterFormat = [System.Drawing.StringFormat]::new()
$letterFormat.Alignment = [System.Drawing.StringAlignment]::Center
$letterFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
$graphics.DrawString('A', $letterFont, $paleBrush, [System.Drawing.RectangleF]::new(310, 218, 172, 172), $letterFormat)

foreach ($size in @(16, 32, 48, 128)) {
    $output = [System.Drawing.Bitmap]::new($size, $size)
    $outputGraphics = [System.Drawing.Graphics]::FromImage($output)
    $outputGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $outputGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $outputGraphics.DrawImage($canvas, 0, 0, $size, $size)
    $output.Save((Join-Path $assetDirectory "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $outputGraphics.Dispose()
    $output.Dispose()
}

foreach ($item in @($backgroundPath, $headPath, $facePath, $navy, $metal, $screen, $paleBrush, $blueBrush, $glassBrush, $blue, $arm, $lens, $handle, $letterFont, $letterFormat)) { $item.Dispose() }
$graphics.Dispose()
$canvas.Dispose()
