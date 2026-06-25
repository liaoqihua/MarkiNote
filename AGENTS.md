# MarkiNote 项目指南（面向 AI 编程助手）

> 本文件面向需要阅读、修改或扩展 MarkiNote 的 AI 编码助手。阅读者默认不了解项目背景，因此以下内容基于实际代码与配置整理，供快速上手。

---

## 项目概览

**MarkiNote** 是一个基于 AI Agent 的 Markdown 文档管理与阅读系统。

- 核心定位：不只是 Markdown 阅读器，而是内置 AI Agent、能直接操作文档库的本地 Web 应用。
- 运行形态：单页 Web 应用（SPA），默认监听 `127.0.0.1:5000`。
- 主要能力：
  - Markdown / TXT / HTML 文件上传、创建、移动、重命名、删除、预览与编辑。
  - Markdown 渲染：GFM、代码高亮、LaTeX 数学公式、Mermaid 图表、表格、目录等。
  - 导出：单文档 PDF / Word、多文档合并 PDF / Word、多文档分别导出为 ZIP。
  - AI 助手：基于 SSE 的流式对话，支持 Function Calling 自动调用 11 种工具管理文件、搜索网页、抓取 URL，并自动备份、可回滚。
- 人机交互语言：项目文档、代码注释、变量名大多使用中文；README 同时提供简体中文与英文版本。

---

## 技术栈

### 后端

| 技术 | 版本/说明 | 用途 |
|------|-----------|------|
| Python | >= 3.8 | 运行环境 |
| Flask | 3.0.0 | Web 框架 |
| Werkzeug | 3.0.1 | WSGI 工具 |
| markdown | 3.5.1 | Markdown 转 HTML |
| beautifulsoup4 / lxml | 4.12.2 / 4.9.3 | HTML 解析与处理 |
| Pygments | 2.17.2 | 代码高亮 |
| requests | >= 2.31.0 | AI API 与网络请求 |
| duckduckgo-search | >= 6.0.0 | DuckDuckGo 搜索 |
| playwright | >= 1.48.0 | 用真实浏览器渲染并导出 PDF |
| waitress | >= 3.0.0 | 生产级 WSGI 服务器 |
| pypdf | >= 5.0.0 | 多 PDF 合并与书签 |
| python-docx | >= 1.1.2 | Word 文档生成 |

### 前端

- 原生 JavaScript（无前端框架）。
- MathJax 3（本地 `static/libs/tex-mml-chtml.js`）渲染 LaTeX。
- Mermaid（本地 `static/libs/mermaid.min.js`）渲染图表。
- html2canvas（本地）用于截图导出 JPG。
- marked.js（本地）用于编辑模式的实时预览。

### 构建与依赖管理

- 使用 [uv](https://docs.astral.sh/uv/) 作为推荐的依赖与虚拟环境管理工具。
- `pyproject.toml` 为项目主配置，依赖以 `dependencies` 列出，开发依赖 `pyinstaller` 放在 `[dependency-groups] dev`。
- `requirements.txt` / `requirements-dev.txt` 由 `uv pip compile` 自动生成，通常无需手动修改。
- `uv.lock` 为 uv 的锁定文件。

---

## 代码组织结构

```text
MarkiNote/
├── main.py                    # 启动入口：参数解析、后台模式、服务器启动
├── app/                       # Flask 后端
│   ├── __init__.py           # create_app() 应用工厂，注册蓝图与请求日志中间件
│   ├── config.py             # Flask 配置（目录、上传限制等）
│   ├── runtime.py            # 运行时路径解析、数据目录初始化、日志、PID 文件
│   ├── routes/               # 蓝图路由
│   │   ├── __init__.py      # 导出 main_bp / library_bp / ai_bp / pdf_bp / word_bp
│   │   ├── main_routes.py   # 首页、Markdown/HTML 预览
│   │   ├── library_routes.py# 文档库 CRUD、上传、移动、重命名、图片服务
│   │   ├── ai_routes.py     # AI 对话流、设置、会话、备份回滚
│   │   └── pdf_routes.py    # PDF 导出接口
│   └── utils/                # 工具模块
│       ├── __init__.py      # 导出 allowed_file / safe_filename / process_markdown
│       ├── file_utils.py    # 文件名校验与安全处理
│       ├── markdown_utils.py# Markdown 渲染预处理
│       ├── pdf_utils.py     # 浏览器渲染 PDF、目录、合并
│       ├── ai_provider.py   # DeepSeek / Kimi API 适配层
│       ├── ai_tools.py      # 11 个 AI 工具定义与执行
│       └── ai_backup.py     # 备份与回滚管理
├── templates/
│   └── index.html            # 单页应用模板
├── static/                   # 前端静态资源
│   ├── script.js            # 主界面逻辑
│   ├── ai-chat.js           # AI 面板逻辑
│   ├── i18n.js              # 4 语言国际化
│   ├── selection-state.js   # 批量选择状态管理
│   ├── style.css / ai-chat.css
│   └── libs/                # 本地第三方库（MathJax、Mermaid、marked、html2canvas）
├── lib/                      # 源码运行时的默认文档库（含 Welcome.md 等示例）
├── scripts/                  # 打包脚本
│   ├── build_exe.py         # uv + PyInstaller 入口
│   └── build_windows.ps1    # Windows 打包辅助脚本
├── MarkiNote.spec            # PyInstaller 配置文件
├── tests/                    # 单元测试
├── pyproject.toml
├── requirements.txt
├── requirements-dev.txt
├── README.md / README_EN.md
└── PACKAGING.md              # 打包与运行时路径说明
```

---

## 构建与运行

### 开发环境

```bash
# 安装依赖（推荐 uv）
uv sync --dev

# 启动开发服务器（Flask 内置开发服务器 + DEBUG 日志）
uv run python main.py

# 指定端口 / 是否自动打开浏览器
uv run python main.py --port 8080 --open-browser
uv run python main.py --no-browser
uv run python main.py --host 127.0.0.1 --port 5000
```

### 运行模式说明

- 默认行为：
  - 源码运行（`python main.py`）：开发模式，Flask 内置服务器，`DEBUG` 日志级别。
  - PyInstaller 打包后运行：生产模式，使用 `waitress`，`INFO` 日志级别。
- 可用 `--debug` / `--production` 强制覆盖，或用环境变量 `MARKINOTE_DEBUG=1`。
- 后台模式：`MarkiNote on` / `MarkiNote off`（打包后）；源码运行时可用 `python main.py on` / `off`，内部通过 subprocess 启动独立进程，并用 PID 文件管理。

### 打包成可执行文件

```bash
# Linux / WSL / Windows 通用（在对应平台运行以获得对应平台可执行文件）
uv sync --dev
uv run python scripts/build_exe.py
```

- Linux/WSL 输出：`dist/MarkiNote`
- Windows 输出：`dist\MarkiNote.exe`
- Windows 也可直接运行 `powershell -ExecutionPolicy Bypass -File scripts\build_windows.ps1`

### PDF 导出依赖

PDF 导出依赖真实 Chromium / Chrome / Edge。若系统没有浏览器，可安装 Playwright Chromium：

```bash
uv run playwright install chromium
```

或显式指定浏览器路径：

```bash
MARKINOTE_CHROMIUM_EXECUTABLE=/path/to/chrome uv run python main.py
```

---

## 测试

### Python 单元测试

测试使用标准库 `unittest` 编写，直接运行：

```bash
# 使用项目虚拟环境
.venv/bin/python -m unittest discover tests -v

# 或使用 uv
uv run python -m unittest discover tests -v
```

现有测试覆盖：

- `tests/test_cli_browser_options.py`：启动参数与浏览器自动打开逻辑。
- `tests/test_markdown_utils.py`：Markdown 表格边界处理。
- `tests/test_pdf_toc.py`：PDF 目录提取与 HTML 生成。
- `tests/test_pdf_batch_separate.py`：批量分别导出 PDF 的 ZIP 响应。

### JavaScript 单元测试

```bash
node tests/test_selection_state.js
```

---

## 代码风格与开发约定

### Python

- 遵循 PEP 8，4 空格缩进，不使用 Tab。
- 函数/变量使用 `snake_case`，类使用 `PascalCase`，常量使用 `UPPER_CASE`。
- 模块/函数使用中文 docstring 说明用途。
- 使用 `from __future__ import annotations` 支持新版类型注解（如 `int | None`）。
- 路径安全：所有用户传入的相对路径必须通过 `os.path.abspath(...).startswith(os.path.abspath(base_path))` 校验，禁止访问文档库外文件。

### JavaScript

- 2 空格缩进。
- 使用 `const` / `let`，避免 `var`。
- 函数/变量使用 `camelCase`。
- 适当添加 JSDoc 风格注释。

### CSS

- 2 空格缩进。
- 类名使用小写连字符 `.my-class`。

### Git 提交规范

项目推荐 conventional commit 风格：

- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `style:` 代码格式调整
- `refactor:` 重构
- `test:` 测试相关
- `chore:` 其他杂项

分支命名：`feature/xxx`、`fix/xxx`、`docs/xxx` 等。

---

## 关键运行时约定

### 数据目录

| 运行模式 | 数据目录 | 说明 |
|----------|----------|------|
| 源码运行 | 项目根目录 | `lib/` 文档库、`.ai_conversations/`、`.ai_backups/`、`ai_settings.json`、`logs/` |
| 打包后运行 | 系统用户级应用数据目录 | Windows: `%LOCALAPPDATA%\MarkiNote\`；macOS: `~/Library/Application Support/MarkiNote/`；Linux: `~/.local/share/MarkiNote/` |

可通过环境变量覆盖：

- `MARKINOTE_DATA_DIR`：自定义数据目录。
- `MARKINOTE_LOG_DIR`：自定义日志目录。

### 常用环境变量

```text
MARKINOTE_HOST                  默认 127.0.0.1
MARKINOTE_PORT                  默认 5000
MARKINOTE_DEBUG                 默认 0，设为 1 开启 Flask debug
MARKINOTE_OPEN_BROWSER          设为 1 默认自动打开浏览器（仍可被 --no-browser 覆盖）
MARKINOTE_NO_BROWSER            设为 1 禁止自动打开浏览器
MARKINOTE_DATA_DIR              数据目录
MARKINOTE_LOG_DIR               日志目录
MARKINOTE_CHROMIUM_EXECUTABLE   指定 PDF 浏览器
MARKINOTE_BROWSER_CHANNELS      PDF 浏览器探测顺序，默认 msedge,chrome,chromium
MARKINOTE_BACKGROUND            内部使用，标识当前为后台子进程
HTTPS_PROXY / HTTP_PROXY        web_search / fetch_url 代理
```

### 日志

- 输出到控制台与日志文件。
- 使用 `RotatingFileHandler`，单文件最大 10MB，保留 5 个备份。
- Flask 请求会自动记录方法、路径、状态码与耗时。

### 文档库安全

- 允许上传/创建的文件扩展名：`md`、`markdown`、`txt`、`html`、`htm`。
- 允许上传的图片扩展名：`png`、`jpg`、`jpeg`、`gif`、`webp`、`svg`、`bmp`、`ico`。
- 单文件上传限制：`MAX_CONTENT_LENGTH = 16MB`。
- 编辑模式粘贴图片自动保存到当前 Markdown 同级的 `.assets/` 目录。

---

## AI Agent 架构要点

- 工具定义在 `app/utils/ai_tools.py` 的 `TOOL_DEFINITIONS` 中，共 11 个：
  `read_file`、`write_file`、`edit_file`、`create_file`、`create_folder`、`delete_item`、`move_item`、`list_directory`、`search_files`、`web_search`、`fetch_url`。
- 所有文件操作限制在 `LIBRARY_FOLDER` 内；路径越界会抛出 `ValueError` 并被工具层捕获。
- 导出路由：`/api/export/pdf`、`/api/export/pdf/batch`、`/api/export/pdf/batch/separate` 与对应的 `/api/export/word/*`。
- AI 设置（provider、model、api_key）保存在数据目录下的 `ai_settings.json`。
- 每次文件修改类工具会自动创建备份组（`BackupManager`），支持按操作组或按会话截断回滚。
- `web_search` 默认先尝试 Bing（国内可直接访问），失败后尝试 DuckDuckGo（通常需要代理）。
- `fetch_url` 对超过 8000 字符的页面会调用 subagent（二次 AI 请求）生成摘要。

---

## 安全注意事项

- **API Key 安全**：`ai_settings.json` 以明文保存用户 API Key。该文件已被 `.gitignore` 排除，**禁止**将其提交到版本库。
- **路径穿越**：所有涉及用户传入路径的接口都已在各路由/工具层通过 `abspath().startswith(base_path)` 校验；新增功能如需处理路径，必须沿用相同校验。
- **AI 工具权限**：AI 能够读取、写入、删除、移动文档库内文件，并搜索/抓取互联网内容。相关接口不应再额外开放任意文件系统或命令执行能力。
- **后台进程安全**：后台模式通过 subprocess 启动新进程，并清理 PyInstaller bootloader 相关环境变量（`_MEIPASS2`、`_PYI_APPLICATION_HOME_DIR` 等），避免子进程继承临时目录导致崩溃。
- **PDF 导出**：使用 headless 浏览器渲染用户上传/生成的 HTML；`build_browser_pdf_html` 中已限制页面尺寸与渲染超时，但仍需注意 HTML 中可能的资源外链。
- **Word 导出**：使用 `python-docx` 将 Markdown 渲染后的 HTML 转换为 `.docx`；图片会读取文档库本地文件并内嵌，外部 URL 仅保留链接文本。Mermaid 图表与 PDF 导出共用同一套浏览器渲染流程，将图表渲染为 PNG 后嵌入 Word；若系统无可用 Chromium/Chrome/Edge，则降级保留源代码。

---

## 延伸阅读

- `README.md`：项目详细介绍、快速开始、功能特性。
- `README_EN.md`：英文版说明。
- `PACKAGING.md`：打包细节、运行时目录、环境变量完整列表。
- `CONTRIBUTING.md`：贡献流程、代码规范、提交信息规范。
