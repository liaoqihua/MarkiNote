# MarkiNote ✨

<div align="center">
  <img src="images/LOGO.png" alt="MarkiNote Logo" width="600"/>
</div>

<div align="center">

![MarkiNote](https://img.shields.io/badge/MarkiNote-✨_AI_Agent_Powered-ff69b4?style=for-the-badge)
[![Python](https://img.shields.io/badge/Python-3.8+-blue?style=for-the-badge&logo=python)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0.0-green?style=for-the-badge&logo=flask)](https://flask.palletsprojects.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

**An AI Agent-powered Markdown Document Management & Reading System** 🤖📝

English | [简体中文](README.md)

[Preview](#-preview) • [Quick Start](#-quick-start) • [Features](#-features) • [AI Agent](#-ai-agent-capabilities) • [Contributing](#-contributing)

</div>

---

## ✨ About

**MarkiNote✨** is not just a Markdown reader — it's an **intelligent document management system powered by a built-in AI Agent**.

The AI Agent understands your intent and autonomously invokes 11 different tools to read, create, edit, delete, move files, and even search the web or fetch webpage content. Every file modification made by the AI is automatically backed up with one-click rollback support, so you can confidently let AI manage your documents.

### Why MarkiNote?

- 🤖 **AI Agent**: More than chatting — AI directly operates your document library (read, write, edit, delete, move, search)
- 🔧 **11 Tools**: AI autonomously decides which tools to call via Function Calling — a true Agent experience
- 🔄 **Auto Backup & Rollback**: Every AI file modification is automatically backed up with per-step or batch rollback
- 📝 **Full Markdown Rendering**: LaTeX math, Mermaid diagrams, syntax highlighting — all supported
- 📚 **Document Manager**: Upload, create, move, rename, delete — manage docs like a file manager
- 🌍 **Multi-language / Multi-theme**: Supports 中文 / English / Français / 日本語, with 4 switchable themes
- 🚀 **Lightweight**: Built on Flask + Vanilla JS, no frontend framework needed, fast startup and low resource usage

---

## 🤖 AI Agent Capabilities

This is MarkiNote's core highlight. The AI assistant isn't a simple Q&A bot — it's a **real Agent with tool-calling capabilities**:

### Tool List

| Tool | Description |
|------|-------------|
| `read_file` | Read file content, supports reading by line range |
| `write_file` | Overwrite file content (auto backup) |
| `edit_file` | Find-and-replace editing (auto backup) |
| `create_file` | Create new file with initial content |
| `create_folder` | Create folder, supports nested directories |
| `delete_item` | Delete file or folder (auto backup) |
| `move_item` | Move or rename file/folder (auto backup) |
| `list_directory` | List directory contents |
| `search_files` | Full-text search across the document library |
| `web_search` | Search the internet (Bing / DuckDuckGo) |
| `fetch_url` | Fetch webpage content with auto AI summarization for large pages |

### Agent Workflow

```
User Instruction → AI Understands Intent → Selects Tools → Executes → Returns Result
                        ↓
              Multi-turn iteration (up to 15 rounds)
                        ↓
          All file changes auto-backed up → One-click rollback
```

### Supported AI Providers

Currently supports the following AI services (all OpenAI API-compatible, easily extensible):

| Provider | Models |
|----------|--------|
| **DeepSeek** | DeepSeek-V4 Pro / DeepSeek-V4 Flash / DeepSeek-V3.2 |
| **Kimi Code** | Kimi Code (Subscription) |

> 💡 AI settings (provider, model, API Key) are persisted to `ai_settings.json` in the data directory, so they won't be lost when clearing browser cache.

---

## 🎯 Features

### 📂 File Management
- ✅ Upload individual files or entire folders
- ✅ Create, delete, move, rename files and folders
- ✅ Breadcrumb navigation for easy browsing
- ✅ Context menu for quick actions
- ✅ File search

### 📝 Markdown Rendering
- ✅ Real-time Markdown rendering
- ✅ GFM (GitHub Flavored Markdown) support
- ✅ Syntax highlighting (Pygments)
- ✅ Math formula rendering (MathJax 3)
- ✅ Mermaid diagrams (flowcharts, sequence diagrams, Gantt charts, etc.)
- ✅ Tables, lists, blockquotes — full support
- ✅ View / Edit source code
- ✅ Export a single document to PDF
- ✅ Select any number of documents and export them as one merged PDF or separate PDFs in a ZIP file
- ✅ Fullscreen reading mode

### 🤖 AI Assistant
- ✅ Sidebar AI chat panel
- ✅ Streaming output (SSE) with real-time responses
- ✅ Tool call cards with visual operation display
- ✅ Conversation history management (create, rename, delete)
- ✅ Message editing & rollback (auto-restores file changes on rollback)
- ✅ File attachments: send documents from the library as context
- ✅ Context awareness: auto-links the currently previewed file
- ✅ Web search & webpage content fetching

### 🎨 UI & Experience
- ✅ 4 Themes: Light / Dark / Blue / Pink
- ✅ 4 Languages: 中文 / English / Français / 日本語
- ✅ Draggable resize for sidebar and AI panel
- ✅ One-click screenshot export to JPG
- ✅ Responsive layout for different screen sizes

---

## 📸 Preview

<div align="center">
<img src="images/1.png" alt="Main Interface" width="600"/>
<p><em>📖 Content browsing & file management — document tree + live rendering</em></p>
</div>

<div align="center">
<img src="images/2.png" alt="Math & Code" width="600"/>
<p><em>🔢 LaTeX math formulas & syntax-highlighted code blocks</em></p>
</div>

<div align="center">
<img src="images/3.png" alt="Mermaid Diagrams" width="600"/>
<p><em>📊 Mermaid flowcharts, sequence diagrams, and more</em></p>
</div>

<div align="center">
<img src="images/4.png" alt="AI Agent Chat" width="600"/>
<p><em>🤖 AI Agent chat panel — smart tool calling with visual operation process</em></p>
</div>

<div align="center">
<img src="images/5.png" alt="AI File Operations" width="600"/>
<p><em>🔧 AI autonomously reads & edits files — every operation is rollbackable</em></p>
</div>

<div align="center">
<img src="images/6.png" alt="Dark Theme" width="600"/>
<p><em>🌙 Dark theme — easy on the eyes for nighttime use</em></p>
</div>

<div align="center">
<img src="images/7.png" alt="Multi-language" width="600"/>
<p><em>🌍 Multi-language interface — Chinese / English / French / Japanese</em></p>
</div>

---

## 🚀 Quick Start

### Requirements

- Python 3.8 or higher
- [uv](https://docs.astral.sh/uv/) package manager (recommended)

### Installation

1️⃣ **Clone the repository**
```bash
git clone https://github.com/liaoqihua/MarkiNote.git
cd MarkiNote
```

2️⃣ **Install dependencies**
```bash
uv sync --dev
```

3️⃣ **Start the application**
```bash
uv run python main.py
```

4️⃣ **Open your browser**

The app opens your browser automatically. You can also manually visit `http://localhost:5000`.

### Configure the AI Assistant

1. Get an API Key: Visit [DeepSeek Platform](https://platform.deepseek.com/) or [Kimi Code Console](https://www.kimi.com/code/) to obtain an API Key
2. Open the AI panel in the app (click the 🤖 button in the top right)
3. Click the settings icon, select AI provider and model, enter your API Key
4. Click "Validate" to confirm the connection, then start chatting!

> 💡 **Config Storage**: Your API Key, provider, and model selections are automatically saved to the local config file `ai_settings.json` (in the data directory), no need to re-enter.
> **Tip**: To use DuckDuckGo with the `web_search` tool, set the `HTTPS_PROXY` environment variable. By default, Bing search is used.

---

## 📖 Usage Guide

### Basic Operations

1. **Upload files** — Click the "Upload" button in the sidebar
2. **Preview documents** — Click a file in the left panel for live rendering on the right
3. **Export PDF** — Click "Export PDF" in the preview toolbar for the current document, or select any number of documents in the left panel and click the bottom PDF button. Batch export can either merge all documents into one PDF or export one PDF per document in a ZIP file
4. **Manage files** — Right-click files/folders to rename, move, or delete

### Data Directory & Logs

Uploaded Markdown / TXT files are saved in the document library directory. **Directory location depends on the run mode:**

| Run Mode | Library (Data) Directory | Log Directory |
|----------|------------------------|---------------|
| Source run `python main.py` | Project root `lib/` | Project root `logs/` |
| Packaged run (exe) | System app data `lib/` | System log directory |

**Source run** — data files live in the project root:

```text
lib/                   Document library (Markdown / TXT files)
lib/<doc-dir>/.assets/   Pasted images in edit mode (a `.assets/` subdirectory next to the current Markdown file)
logs/                  Log files (auto-rotated, max 10 MB per file, 5 backups kept)
.ai_conversations/     AI conversation history
.ai_backups/           AI change backups
ai_settings.json       AI configuration (provider, model, API Key)
```

> 🖼️ **Image storage**: When you paste (`Ctrl+V`) an image from the clipboard in edit mode, it is automatically uploaded and saved to the `.assets/` subdirectory next to the current Markdown file (e.g. `lib/notes/.assets/paste_20260515120000.png`). The Markdown file references it via the relative path `.assets/xxx.png`.

**Packaged run** — data files are stored in system user directories:

| OS | Data Directory | Log Directory |
|-----|--------------|-------------|
| Windows | `%LOCALAPPDATA%\MarkiNote\` | `%LOCALAPPDATA%\MarkiNote\logs\` |
| macOS | `~/Library/Application Support/MarkiNote/` | `~/Library/Logs/MarkiNote/` |
| Linux | `~/.local/share/MarkiNote/` | `~/.local/state/MarkiNote/logs/` |

> 💡 Paths can be overridden with `MARKINOTE_DATA_DIR` / `MARKINOTE_LOG_DIR` environment variables.

Log level details:

| Mode | Log Level | Description |
|------|----------|-------------|
| Dev mode (`--debug`) | DEBUG | Detailed debug info including Markdown processing, API request details, performance stats |
| Production mode (default) | INFO | Only important operations, warnings, and errors |

Log format: `Time [Level] Module: Message`

Logs are written to both the **console (terminal)** and **log file**. Flask request logs (method, path, status code, duration) are also recorded automatically.

Startup arguments can control whether the browser opens automatically:

```bash
uv run python main.py --open-browser   # Open browser after startup
uv run python main.py --no-browser     # Do not open browser after startup
uv run python main.py --host 127.0.0.1 --port 8080
```

PDF export uses a real Chromium / Chrome / Edge browser to render and print, so Mermaid diagrams, MathJax formulas, and CSS match the live browser preview. Exported PDFs automatically include a front-page table of contents based on Markdown headings and enable PDF outline/bookmarks. If Chrome/Edge is not installed, install Playwright Chromium:

```bash
uv run playwright install chromium
```

You can also specify the browser executable explicitly:

```bash
MARKINOTE_CHROMIUM_EXECUTABLE=/path/to/chrome uv run python main.py
```

### Using the AI Assistant

1. **Open the AI panel** — Click the AI button in the top right
2. **Chat with AI** — Describe what you need, for example:
   - "Create a study notes template for me"
   - "Reorganize the files in the notes folder by date"
   - "Search my documents for Python content and summarize it"
   - "Translate this document to English"
3. **File context** — When previewing a file, AI auto-links it; you can also manually attach multiple files
4. **Rollback** — If you're not happy with an AI change, click "Rollback" on the tool card to restore

---

## 📦 Packaging as an Executable

This project is configured for `uv + PyInstaller`. Note: `uv build` creates a Python package, not an exe; the standalone executable is produced by PyInstaller.

Linux / WSL packaging:

```bash
uv sync --dev
uv run python scripts/build_exe.py
```

Output:

```text
dist/MarkiNote
```

To build a Windows `.exe`, run the packaging command from Windows PowerShell / CMD:

```powershell
uv sync --dev
uv run python scripts/build_exe.py
```

Or:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build_windows.ps1
```

Output:

```text
dist\MarkiNote.exe
```

See [PACKAGING.md](PACKAGING.md) for details.

---

## 📁 Project Structure

```
MarkiNote/
├── app/                          # Flask backend
│   ├── __init__.py              # App factory
│   ├── config.py                # Configuration
│   ├── runtime.py               # Runtime paths, resource lookup, and logging
│   ├── routes/                  # Route modules
│   │   ├── main_routes.py      # Main routes (page rendering)
│   │   ├── library_routes.py   # Document library API (CRUD)
│   │   ├── pdf_routes.py       # PDF export API
│   │   └── ai_routes.py        # AI assistant API (chat/backup/rollback)
│   └── utils/                   # Utility modules
│       ├── file_utils.py       # File operations
│       ├── markdown_utils.py   # Markdown rendering
│       ├── pdf_utils.py        # Browser-rendered PDF export
│       ├── ai_provider.py      # AI provider adapter
│       ├── ai_tools.py         # AI tool definitions & execution
│       └── ai_backup.py        # Backup & rollback management
├── static/                      # Frontend assets
│   ├── script.js               # Main frontend logic
│   ├── ai-chat.js              # AI chat panel
│   ├── i18n.js                 # Internationalization (4 languages)
│   ├── style.css               # Main styles
│   ├── ai-chat.css             # AI panel styles
│   └── libs/                   # Locally hosted third-party libs
│       ├── tex-mml-chtml.js    # MathJax
│       ├── mermaid.min.js      # Mermaid
│       └── html2canvas.min.js  # html2canvas
├── templates/
│   └── index.html              # Single-page app template
├── lib/                         # Default document library for source runs
├── scripts/                     # Packaging scripts
│   ├── build_exe.py             # uv + PyInstaller packaging entrypoint
│   └── build_windows.ps1        # Windows packaging helper
├── MarkiNote.spec               # PyInstaller configuration
├── PACKAGING.md                 # Packaging and runtime-path guide
├── pyproject.toml               # uv project configuration
├── main.py                      # Entry point
├── requirements.txt             # Python dependencies
├── LICENSE                      # MIT License
└── README.md
```

---

## 🛠️ Tech Stack

### Backend
- **Flask 3.0.0** — Web framework
- **markdown + BeautifulSoup4** — Markdown parsing & HTML processing
- **Pygments** — Code syntax highlighting
- **requests** — AI API calls and web fetching
- **Playwright** — Render and export PDFs with real Chromium / Chrome / Edge
- **OpenAI-compatible APIs** — DeepSeek / Moonshot and other providers

### Frontend
- **Vanilla JavaScript** — Zero framework dependencies
- **MathJax 3** — LaTeX math rendering
- **Mermaid** — Diagram rendering
- **html2canvas** — Screenshot export
- **SSE (Server-Sent Events)** — AI streaming responses

### AI Agent
- **Function Calling** — AI autonomously invokes 11 tools
- **Streaming Chat (SSE)** — Real-time display of AI replies and tool calls
- **Auto Backup System** — Pre/post modification snapshots with operation-group rollback
- **Subagent Architecture** — Large webpage content auto-summarized by a secondary AI call

---

## 🤝 Contributing

Contributions of all kinds are welcome!

### How to Contribute

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Report Issues

Found a bug or have a feature suggestion? Let us know in [Issues](https://github.com/wink-wink-wink555/MarkiNote/issues)!

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 💖 Acknowledgments

Thanks to these open source projects:
- [Flask](https://flask.palletsprojects.com/)
- [MathJax](https://www.mathjax.org/)
- [Mermaid](https://mermaid.js.org/)
- [DeepSeek](https://deepseek.com/)
- [Moonshot AI](https://www.moonshot.cn/)

---

<div align="center">

**Made with ❤️ by [wink-wink-wink555](https://github.com/wink-wink-wink555)**

If this project helps you, please give it a ⭐️!

</div>
