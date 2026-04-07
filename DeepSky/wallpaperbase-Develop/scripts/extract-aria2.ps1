# 解压 aria2 zip 文件的 PowerShell 脚本
# 使用方法: .\scripts\extract-aria2.ps1

$zipPath = "resources\aria2\win32\x64\aria2-1.37.0-win-64bit-build1.zip"
$destDir = "resources\aria2\win32\x64"
$targetFile = "aria2c.exe"

if (Test-Path $zipPath) {
    Write-Host "找到 zip 文件: $zipPath"
    Write-Host "正在解压..."
    
    # 解压到临时目录
    $tempDir = Join-Path $destDir "temp_extract"
    if (Test-Path $tempDir) {
        Remove-Item $tempDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    
    try {
        Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force
        
        # 查找 aria2c.exe
        $aria2cPath = Get-ChildItem -Path $tempDir -Recurse -Filter "aria2c.exe" | Select-Object -First 1
        
        if ($aria2cPath) {
            $targetPath = Join-Path $destDir $targetFile
            Copy-Item $aria2cPath.FullName -Destination $targetPath -Force
            Write-Host "✓ 解压成功: $targetPath"
            
            # 清理临时文件
            Remove-Item $tempDir -Recurse -Force
            Remove-Item $zipPath -Force
            
            Write-Host "✓ 清理完成"
        } else {
            Write-Host "✗ 未找到 aria2c.exe"
        }
    } catch {
        Write-Host "✗ 解压失败: $_"
    }
} else {
    Write-Host "✗ 未找到 zip 文件: $zipPath"
    Write-Host ""
    Write-Host "请先下载 aria2:"
    Write-Host "  npm run download-aria2"
    Write-Host ""
    Write-Host "或手动下载:"
    Write-Host "  https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-win-64bit-build1.zip"
    Write-Host "  下载后放置到: $zipPath"
}

