# MarkiNote 打包说明

本项目已经适配 uv + PyInstaller，可以打包成一个完整可执行文件。

## 重要说明

- `uv build` 生成的是 Python 包，不是 exe。
- 这里使用 `uv` 管理依赖，使用 `PyInstaller` 生成可执行文件。
- 在 WSL/Linux 下打包得到 Linux 可执行文件。
- 要得到 Windows `.exe`，请在 Windows PowerShell/CMD 里打包。

## 源码运行

```bash
uv sync --dev
uv run python main.py

# 不自动打开浏览器
uv run python main.py --no-browser

# 指定端口并自动打开浏览器
uv run python main.py --port 8080 --open-browser
```

启动后访问：

```text
http://localhost:5000
```

## Linux/WSL 打包

```bash
uv sync --dev
uv run python scripts/build_exe.py
```

输出：

```text
dist/MarkiNote
```

## Windows 打包

在 Windows PowerShell 中进入项目目录，然后执行：

```powershell
uv sync --dev
uv run python scripts/build_exe.py
```

或者直接运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build_windows.ps1
```

输出：

```text
dist\MarkiNote.exe
```

## 运行时数据目录

打包后程序会把需要读写的数据放到系统推荐的用户级应用数据目录，而不是可执行文件旁边：

```text
Windows: %LOCALAPPDATA%\MarkiNote\
macOS:   ~/Library/Application Support/MarkiNote/
Linux:   ~/.local/share/MarkiNote/ 或 $XDG_DATA_HOME/MarkiNote/
```

里面包含：

```text
lib/                 文档库，可读写；上传的 md/txt 文件保存在这里
.ai_conversations/   AI 对话历史
.ai_backups/         AI 修改备份
```

源码运行时，默认继续使用项目根目录作为数据目录，方便开发调试。

如需指定数据目录，可以设置环境变量：

```bash
MARKINOTE_DATA_DIR=/path/to/data uv run python main.py
```

Windows PowerShell：

```powershell
$env:MARKINOTE_DATA_DIR="D:\MarkiNote_Data"
.\dist\MarkiNote.exe
```

## 日志输出

程序现在会同时输出到：

1. 控制台
2. 系统推荐的用户级日志文件

默认日志位置：

```text
Windows: %LOCALAPPDATA%\MarkiNote\logs\markinote.log
macOS:   ~/Library/Logs/MarkiNote/markinote.log
Linux:   ~/.local/state/MarkiNote/logs/markinote.log
```

如需指定日志目录，可以设置环境变量：

```bash
MARKINOTE_LOG_DIR=/path/to/logs uv run python main.py
```

Windows PowerShell：

```powershell
$env:MARKINOTE_LOG_DIR="D:\MarkiNote_Logs"
.\dist\MarkiNote.exe
```

## PDF 导出浏览器依赖

PDF 导出使用真实 Chromium / Chrome / Edge 渲染页面并打印 PDF，用于保证 Mermaid、MathJax、CSS 等效果与浏览器预览一致。导出的 PDF 会根据 Markdown 标题自动生成首页目录，并启用 PDF outline/bookmarks。

优先使用系统浏览器：

- Windows：Microsoft Edge 或 Chrome
- macOS：Chrome / Chromium / Edge
- Linux：Chrome / Chromium / Edge

如果系统没有可用浏览器，可以安装 Playwright Chromium：

```bash
uv run playwright install chromium
```

也可以显式指定浏览器可执行文件：

```bash
MARKINOTE_CHROMIUM_EXECUTABLE=/path/to/chrome uv run python main.py
```

Windows PowerShell：

```powershell
$env:MARKINOTE_CHROMIUM_EXECUTABLE="C:\Program Files\Google\Chrome\Application\chrome.exe"
.\dist\MarkiNote.exe
```

## 常用环境变量

```text
MARKINOTE_HOST       默认 127.0.0.1
MARKINOTE_PORT       默认 5000
MARKINOTE_DEBUG      默认 0，设为 1 开启 Flask debug
MARKINOTE_NO_BROWSER 默认空，设为 1 禁止自动打开浏览器
MARKINOTE_DATA_DIR   指定外部数据目录
MARKINOTE_LOG_DIR    指定外部日志目录
MARKINOTE_CHROMIUM_EXECUTABLE 指定 PDF 导出使用的 Chrome/Edge/Chromium 路径
MARKINOTE_BROWSER_CHANNELS    PDF 导出浏览器 channel 探测顺序，默认 msedge,chrome,chromium
```

例子：

```bash
MARKINOTE_PORT=8080 MARKINOTE_NO_BROWSER=1 uv run python main.py
```
