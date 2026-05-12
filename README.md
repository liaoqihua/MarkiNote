# MarkiNote ✨

<div align="center">
  <img src="images/LOGO.png" alt="MarkiNote Logo" width="600"/>
</div>

<div align="center">

![MarkiNote](https://img.shields.io/badge/MarkiNote-✨_AI_Agent_Powered-ff69b4?style=for-the-badge)
[![Python](https://img.shields.io/badge/Python-3.8+-blue?style=for-the-badge&logo=python)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0.0-green?style=for-the-badge&logo=flask)](https://flask.palletsprojects.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

**一个基于 AI Agent 的智能 Markdown 文档管理与阅读系统** 🤖📝

[English](README_EN.md) | 简体中文

[产品预览](#-产品预览) • [快速开始](#-快速开始) • [功能特性](#-功能特性) • [AI Agent](#-ai-agent-能力) • [贡献](#-贡献)

</div>

---

## ✨ 项目简介

**MarkiNote✨** 不只是一个 Markdown 阅读器——它是一个 **内置 AI Agent 的智能文档管理系统**。

AI Agent 能理解你的意图，自主调用 11 种工具来读取、创建、编辑、删除、移动文件，甚至搜索互联网和抓取网页内容。每一次 AI 对文件的修改都会自动备份，支持一键回滚，让你放心地把文档管理交给 AI。

### 为什么选择 MarkiNote？

- 🤖 **AI Agent**：不只是聊天，AI 能直接操作你的文档库（读、写、编辑、删除、移动、搜索）
- 🔧 **11 种工具**：AI 通过 Function Calling 自主决策调用工具，真正的 Agent 体验
- 🔄 **自动备份与回滚**：AI 的每次文件修改都自动备份，支持单步/批量回滚
- 📝 **Markdown 全能渲染**：LaTeX 数学公式、Mermaid 图表、代码高亮，一应俱全
- 📚 **文档管理器**：上传、新建、移动、重命名、删除，像文件管理器一样管理文档
- 🌍 **多语言 / 多主题**：支持中文 / English / Français / 日本語，4 种主题可切换
- 🚀 **轻量级**：基于 Flask + 原生 JS，无需前端框架，启动快资源省

---

## 🤖 AI Agent 能力

这是 MarkiNote 的核心亮点。AI 助手不是简单的问答，而是一个**拥有真实工具调用能力的 Agent**：

### 工具列表

| 工具 | 说明 |
|------|------|
| `read_file` | 读取文件内容，支持按行范围分段读取 |
| `write_file` | 覆盖写入文件（自动备份） |
| `edit_file` | 查找替换方式局部编辑文件（自动备份） |
| `create_file` | 创建新文件并写入内容 |
| `create_folder` | 创建文件夹，支持多级目录 |
| `delete_item` | 删除文件或文件夹（自动备份） |
| `move_item` | 移动或重命名文件/文件夹（自动备份） |
| `list_directory` | 列出目录内容 |
| `search_files` | 在文档库中全文搜索关键词 |
| `web_search` | 搜索互联网信息（Bing / DuckDuckGo） |
| `fetch_url` | 抓取网页内容，大型页面自动 AI 摘要 |

### Agent 工作流

```
用户指令 → AI 理解意图 → 自主选择工具 → 执行操作 → 返回结果
                ↓
          可多轮迭代调用（最多 15 轮）
                ↓
        所有文件修改自动备份 → 支持一键回滚
```

### AI 提供商

目前支持以下 AI 服务（均兼容 OpenAI API 格式，可自行扩展）：

| 提供商 | 模型 |
|--------|------|
| **DeepSeek** | DeepSeek-V4 Pro / DeepSeek-V4 Flash / DeepSeek-V3.2 |
| **Kimi Code** | Kimi Code（会员订阅制） |

> 💡 AI 设置（提供商、模型、API Key）会持久化保存到数据目录下的 `ai_settings.json` 文件中，不会因清除浏览器缓存而丢失。

---

## 🎯 功能特性

### 📂 文件管理
- ✅ 上传单个文件或整个文件夹
- ✅ 创建、删除、移动、重命名文件和文件夹
- ✅ 面包屑导航，轻松浏览文件结构
- ✅ 右键菜单快捷操作
- ✅ 文件搜索

### 📝 Markdown 渲染
- ✅ 实时渲染 Markdown 文档
- ✅ 支持 GFM (GitHub Flavored Markdown)
- ✅ 代码高亮显示 (Pygments)
- ✅ 数学公式渲染 (MathJax 3)
- ✅ Mermaid 图表（流程图、时序图、甘特图等）
- ✅ 表格、列表、引用等完整支持
- ✅ 查看 / 编辑源代码
- ✅ 单文档导出 PDF
- ✅ 勾选任意数量文档，合并导出为一个 PDF，或分别导出为多个 PDF（ZIP）
- ✅ 全屏阅读模式

### 🤖 AI 助手
- ✅ 侧边栏 AI 对话面板
- ✅ 流式输出（SSE），实时显示回复
- ✅ 工具调用卡片，可视化展示 AI 操作过程
- ✅ 对话历史管理（新建、重命名、删除）
- ✅ 消息编辑与回滚（回滚时自动恢复文件修改）
- ✅ 文件附件：发送时附加文档库中的文件内容
- ✅ 上下文感知：自动关联当前预览的文件
- ✅ 联网搜索与网页内容抓取

### 🎨 界面与体验
- ✅ 4 种主题：浅色 / 深色 / 蓝色 / 粉色
- ✅ 4 种语言：中文 / English / Français / 日本語
- ✅ 可拖拽调整侧边栏和 AI 面板宽度
- ✅ 一键截图导出 JPG
- ✅ 响应式布局，适配不同屏幕

---

## 📸 产品预览

<div align="center">
<img src="images/1.png" alt="主界面" width="600"/>
<p><em>📖 内容浏览与文件管理，左侧文档树 + 右侧实时渲染</em></p>
</div>

<div align="center">
<img src="images/2.png" alt="数学公式与代码" width="600"/>
<p><em>🔢 LaTeX 数学公式 & 代码高亮渲染</em></p>
</div>

<div align="center">
<img src="images/3.png" alt="Mermaid 图表" width="600"/>
<p><em>📊 Mermaid 流程图、时序图等图表渲染</em></p>
</div>

<div align="center">
<img src="images/4.png" alt="AI Agent 对话" width="600"/>
<p><em>🤖 AI Agent 对话面板 — 智能工具调用，可视化操作过程</em></p>
</div>

<div align="center">
<img src="images/5.png" alt="AI 文件操作" width="600"/>
<p><em>🔧 AI 自主读取、编辑文件，每步操作都可回滚</em></p>
</div>

<div align="center">
<img src="images/6.png" alt="深色主题" width="600"/>
<p><em>🌙 深色主题 — 夜间使用更护眼</em></p>
</div>

<div align="center">
<img src="images/7.png" alt="多语言支持" width="600"/>
<p><em>🌍 多语言界面切换 — 中/英/法/日</em></p>
</div>

---

## 🚀 快速开始

### 环境要求

- Python 3.8 或更高版本
- [uv](https://docs.astral.sh/uv/) 包管理器（推荐）

### 安装步骤

1️⃣ **克隆项目**
```bash
git clone https://github.com/liaoqihua/MarkiNote.git
cd MarkiNote
```

2️⃣ **安装依赖**
```bash
uv sync --dev
```

3️⃣ **启动应用**
```bash
uv run python main.py
```

4️⃣ **打开浏览器**

启动后会自动打开浏览器，也可以手动访问 `http://localhost:5000`。

### 配置 AI 助手

1. 获取 API Key：前往 [DeepSeek 开放平台](https://platform.deepseek.com/) 或 [Kimi Code 控制台](https://www.kimi.com/code/) 获取 API Key
2. 在应用中打开 AI 面板（右上角 🤖 按钮）
3. 点击设置图标，选择 AI 提供商、模型，输入 API Key
4. 点击"验证"确认连接成功，即可开始对话！

> 💡 **配置存储**：API Key、提供商和模型选择会自动保存到本地配置文件 `ai_settings.json`（位于数据目录下），无需重复输入。
> **提示**：如需使用 `web_search` 的 DuckDuckGo 搜索引擎，需要设置代理环境变量 `HTTPS_PROXY`。默认使用 Bing 搜索，国内可直接访问。

---

## 📖 使用指南

### 基础操作

1. **上传文件** — 点击侧边栏的"上传"按钮，选择文件或文件夹
2. **预览文档** — 点击左侧文件列表中的文件，右侧实时渲染
3. **导出 PDF** — 点击预览区的"导出 PDF"导出当前文档；或在左侧勾选任意数量文档后点击底部 PDF 按钮，可选择合并导出为一个 PDF，或按各个文件分别导出并打包为 ZIP
4. **管理文件** — 右键点击文件/文件夹进行重命名、移动、删除等操作

### 数据目录与日志

上传的 Markdown / TXT 文件会保存到文档库目录。**目录位置取决于运行模式：**

| 运行模式 | 文档库（数据）目录 | 日志目录 |
|---------|-----------------|---------|
| 源码运行 `python main.py` | 项目根目录 `lib/` | 项目根目录 `logs/` |
| 打包后运行（exe） | 系统应用数据目录 `lib/` | 系统日志目录 |

**源码运行时**，数据文件保存在项目根目录：

```text
lib/                   文档库（Markdown / TXT 文件）
logs/                  日志文件（自动轮转，单文件最大 10MB，保留 5 个备份）
.ai_conversations/     AI 对话历史
.ai_backups/           AI 修改备份
ai_settings.json       AI 配置（提供商、模型、API Key）
```

**打包后运行时**，保存在系统用户级目录：

| 系统 | 数据目录 | 日志目录 |
|------|---------|---------|
| Windows | `%LOCALAPPDATA%\MarkiNote\` | `%LOCALAPPDATA%\MarkiNote\logs\` |
| macOS | `~/Library/Application Support/MarkiNote/` | `~/Library/Logs/MarkiNote/` |
| Linux | `~/.local/share/MarkiNote/` | `~/.local/state/MarkiNote/logs/` |

> 💡 可以使用 `MARKINOTE_DATA_DIR` / `MARKINOTE_LOG_DIR` 环境变量自定义路径。

日志级别说明：

| 模式 | 日志级别 | 说明 |
|------|---------|------|
| 开发模式（`--debug`） | DEBUG | 详细的调试信息，包含 Markdown 处理细节、API 请求详情、性能统计等 |
| 生产模式（默认） | INFO | 只记录重要操作、警告和错误，减少日志量 |

日志格式：`时间 [级别] 模块名称: 消息内容`

日志会同时输出到**控制台（终端）**和**日志文件**。Flask 请求日志（方法、路径、状态码、耗时）也会自动记录。

启动时可用参数控制是否自动打开浏览器：

```bash
uv run python main.py --open-browser   # 启动后自动打开浏览器
uv run python main.py --no-browser     # 启动后不自动打开浏览器
uv run python main.py --host 127.0.0.1 --port 8080
```

PDF 导出使用真实 Chromium / Chrome / Edge 渲染并打印为 PDF，因此 Mermaid 图表、MathJax 公式和浏览器预览效果保持一致。导出的 PDF 会根据 Markdown 标题自动生成首页目录，并启用 PDF outline/bookmarks。若系统没有 Chrome/Edge，可安装 Playwright Chromium：

```bash
uv run playwright install chromium
```

也可以指定浏览器路径：

```bash
MARKINOTE_CHROMIUM_EXECUTABLE=/path/to/chrome uv run python main.py
```

### AI 助手使用

1. **打开 AI 面板** — 点击右上角的 AI 按钮
2. **直接对话** — 向 AI 描述你的需求，例如：
   - "帮我创建一个学习笔记模板"
   - "把 notes 文件夹下的文件按日期重新组织"
   - "搜索文档库中关于 Python 的内容并总结"
   - "帮我把这篇文档翻译成英文"
3. **文件上下文** — 预览文件时，AI 会自动关联当前文件；也可手动附加多个文件
4. **回滚操作** — 若 AI 的修改不满意，点击工具卡片中的"回滚"按钮即可恢复

---

## 📦 打包成可执行文件

本项目已适配 `uv + PyInstaller`。注意：`uv build` 生成的是 Python 包，不是 exe；完整可执行文件由 PyInstaller 生成。

Linux / WSL 打包：

```bash
uv sync --dev
uv run python scripts/build_exe.py
```

输出：

```text
dist/MarkiNote
```

Windows 打包请在 Windows PowerShell / CMD 中运行，这样才能生成 `.exe`：

```powershell
uv sync --dev
uv run python scripts/build_exe.py
```

或：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build_windows.ps1
```

输出：

```text
dist\MarkiNote.exe
```

更多说明见 [PACKAGING.md](PACKAGING.md)。

---

## 📁 项目结构

```
MarkiNote/
├── app/                          # Flask 后端
│   ├── __init__.py              # 应用工厂函数
│   ├── config.py                # 配置文件
│   ├── runtime.py               # 运行时路径、资源定位与日志配置
│   ├── routes/                  # 路由模块
│   │   ├── main_routes.py      # 主路由（页面渲染）
│   │   ├── library_routes.py   # 文档库 API（CRUD）
│   │   ├── pdf_routes.py       # PDF 导出 API
│   │   └── ai_routes.py        # AI 助手 API（对话/备份/回滚）
│   └── utils/                   # 工具模块
│       ├── file_utils.py       # 文件操作
│       ├── markdown_utils.py   # Markdown 渲染
│       ├── pdf_utils.py        # 浏览器渲染 PDF 导出
│       ├── ai_provider.py      # AI 提供商适配层
│       ├── ai_tools.py         # AI 工具定义与执行
│       └── ai_backup.py        # 备份与回滚管理
├── static/                      # 前端静态资源
│   ├── script.js               # 主前端逻辑
│   ├── ai-chat.js              # AI 对话面板
│   ├── i18n.js                 # 国际化（4 种语言）
│   ├── style.css               # 主样式
│   ├── ai-chat.css             # AI 面板样式
│   └── libs/                   # 本地化第三方库
│       ├── tex-mml-chtml.js    # MathJax
│       ├── mermaid.min.js      # Mermaid
│       └── html2canvas.min.js  # html2canvas
├── templates/
│   └── index.html              # 单页应用模板
├── lib/                         # 源码运行时的默认文档库
├── scripts/                     # 打包脚本
│   ├── build_exe.py             # uv + PyInstaller 打包入口
│   └── build_windows.ps1        # Windows 打包辅助脚本
├── MarkiNote.spec               # PyInstaller 配置
├── PACKAGING.md                 # 打包与运行时路径说明
├── pyproject.toml               # uv 项目配置
├── main.py                      # 启动入口
├── requirements.txt             # Python 依赖
├── LICENSE                      # MIT 许可证
└── README.md
```

---

## 🛠️ 技术栈

### 后端
- **Flask 3.0.0** — Web 框架
- **markdown + BeautifulSoup4** — Markdown 解析与 HTML 处理
- **Pygments** — 代码语法高亮
- **requests** — AI API 调用与网页抓取
- **Playwright** — 使用真实 Chromium / Chrome / Edge 渲染并导出 PDF
- **OpenAI 兼容 API** — 支持 DeepSeek / Kimi 等提供商

### 前端
- **Vanilla JavaScript** — 原生 JS，零框架依赖
- **MathJax 3** — LaTeX 数学公式渲染
- **Mermaid** — 图表渲染
- **html2canvas** — 截图导出
- **SSE (Server-Sent Events)** — AI 流式响应

### AI Agent
- **Function Calling** — AI 自主调用 11 种工具
- **流式对话 (SSE)** — 实时展示 AI 回复与工具调用
- **自动备份系统** — 文件修改前后快照，支持按操作组回滚
- **Subagent 架构** — 大型网页内容自动调用二级 AI 生成摘要

---

## 🤝 贡献

欢迎所有形式的贡献！

### 如何贡献

1. Fork 这个项目
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

### 报告问题

如果你发现了 bug 或有功能建议，请在 [Issues](https://github.com/wink-wink-wink555/MarkiNote/issues) 中告诉我们！

---

## 📄 许可证

本项目采用 MIT 许可证 — 详见 [LICENSE](LICENSE) 文件

---

## 💖 致谢

感谢以下开源项目：
- [Flask](https://flask.palletsprojects.com/)
- [MathJax](https://www.mathjax.org/)
- [Mermaid](https://mermaid.js.org/)
- [DeepSeek](https://deepseek.com/)
- [Moonshot AI](https://www.moonshot.cn/)

---

<div align="center">

**Made with ❤️ by [wink-wink-wink555](https://github.com/wink-wink-wink555)**

如果这个项目对你有帮助，请给个 ⭐️ 支持一下吧！

</div>
