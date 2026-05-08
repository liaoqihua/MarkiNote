# 在 Windows PowerShell 中运行，用于生成 dist\MarkiNote.exe
# 如果系统没有 uv，请先安装：https://docs.astral.sh/uv/getting-started/installation/

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

uv sync --dev
uv run python scripts/build_exe.py

Write-Host ""
Write-Host "完成：dist\MarkiNote.exe"
Write-Host "运行后文档库默认在：$env:LOCALAPPDATA\MarkiNote\lib"
Write-Host "运行后日志默认在：$env:LOCALAPPDATA\MarkiNote\logs\markinote.log"
