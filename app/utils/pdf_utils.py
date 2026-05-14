"""PDF 导出工具。

PDF 导出使用真实浏览器渲染 HTML 后打印为 PDF，确保 Mermaid、MathJax、CSS 等效果尽量与浏览器预览一致。
"""
from __future__ import annotations

import html
import logging
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from bs4 import BeautifulSoup
from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

from app.utils.markdown_utils import process_markdown


SUPPORTED_EXPORT_EXTENSIONS = {'.md', '.markdown', '.txt'}
logger = logging.getLogger(__name__)


@dataclass
class TocEntry:
    """PDF 目录条目。"""

    level: int
    title: str
    anchor: str
    document_title: str


@dataclass
class PdfDocument:
    """待导出的文档。"""

    path: str
    title: str
    markdown: str
    html: str


def safe_library_file(base_dir: str | os.PathLike[str], rel_path: str) -> Path:
    """解析并校验文档库内的相对文件路径。"""
    if not rel_path or not isinstance(rel_path, str):
        raise ValueError('文件路径不能为空')

    normalized = rel_path.replace('\\', '/').strip('/')
    base = Path(base_dir).resolve()
    target = (base / normalized).resolve()

    if not str(target).startswith(str(base)):
        raise ValueError('非法路径')
    if not target.exists():
        raise FileNotFoundError('文件不存在')
    if not target.is_file():
        raise ValueError('只能导出文件，不能导出文件夹')
    if target.suffix.lower() not in SUPPORTED_EXPORT_EXTENSIONS:
        raise ValueError('只支持导出 .md、.markdown、.txt 文件')

    return target


def read_pdf_document(base_dir: str | os.PathLike[str], rel_path: str) -> PdfDocument:
    """读取单个文档并渲染为 HTML。"""
    target = safe_library_file(base_dir, rel_path)
    markdown = target.read_text(encoding='utf-8')
    rendered = process_markdown(markdown)
    return PdfDocument(
        path=rel_path.replace('\\', '/').strip('/'),
        title=target.name,
        markdown=markdown,
        html=rendered,
    )


def slugify_filename(name: str, default: str = 'MarkiNote') -> str:
    """生成适合下载的 PDF 文件名。"""
    stem = Path(name).stem or default
    stem = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', '_', stem).strip(' ._')
    return f'{stem or default}.pdf'


def _join_static_url(static_base_url: str, filename: str) -> str:
    return f"{static_base_url.rstrip('/')}/static/{filename.lstrip('/')}"


def extract_toc_entries(documents: Iterable[PdfDocument]) -> list[TocEntry]:
    """从导出 HTML 的 h1-h6 标题中提取目录，并为缺少 id 的标题补充锚点。"""
    entries: list[TocEntry] = []

    for doc_index, doc in enumerate(documents, start=1):
        soup = BeautifulSoup(doc.html, 'html.parser')
        changed = False
        heading_index = 0

        for heading in soup.find_all(re.compile(r'^h[1-6]$')):
            title = heading.get_text(' ', strip=True)
            if not title:
                continue

            heading_index += 1
            anchor = heading.get('id') or f'doc-{doc_index}-heading-{heading_index}'
            if not heading.get('id'):
                heading['id'] = anchor
                changed = True

            entries.append(TocEntry(
                level=int(heading.name[1]),
                title=title,
                anchor=anchor,
                document_title=doc.title,
            ))

        if changed:
            doc.html = str(soup)

    return entries


def build_toc_html(entries: Iterable[TocEntry]) -> str:
    """生成 PDF 首页可见目录。"""
    toc_entries = list(entries)
    if not toc_entries:
        return ''

    items = []
    for entry in toc_entries:
        level = min(max(entry.level, 1), 6)
        items.append(
            f'<li class="pdf-toc-item pdf-toc-level-{level}">'
            f'<a href="#{html.escape(entry.anchor)}">{html.escape(entry.title)}</a>'
            f'</li>'
        )

    return f'''
    <nav class="pdf-toc" aria-label="目录">
        <h1 class="pdf-toc-title">目录</h1>
        <ol class="pdf-toc-list">
            {''.join(items)}
        </ol>
    </nav>
    '''


def build_browser_pdf_html(
    documents: Iterable[PdfDocument],
    *,
    title: str = 'MarkiNote Export',
    static_base_url: str = '',
) -> str:
    """生成交给浏览器渲染/打印的完整 HTML。"""
    docs = list(documents)
    toc_entries = extract_toc_entries(docs)
    toc_html = build_toc_html(toc_entries)
    parts: list[str] = []

    for index, doc in enumerate(docs):
        page_break_class = ' pdf-page-break' if index else ''
        parts.append(
            f'''
            <article class="pdf-document{page_break_class}">
                <h1 class="pdf-document-title">{html.escape(doc.title)}</h1>
                <div class="pdf-document-path">{html.escape(doc.path)}</div>
                <div class="markdown-body">{doc.html}</div>
            </article>
            '''
        )

    style_url = _join_static_url(static_base_url, 'style.css')
    mermaid_url = _join_static_url(static_base_url, 'libs/mermaid.min.js')
    mathjax_url = _join_static_url(static_base_url, 'libs/tex-mml-chtml.js')

    return f'''<!doctype html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{html.escape(title)}</title>
    <link rel="stylesheet" href="{style_url}">
    <script>
    window.MathJax = {{
        tex: {{
            inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
            displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
            processEscapes: true,
            processEnvironments: true
        }},
        chtml: {{ fontURL: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2' }},
        options: {{
            skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
            ignoreHtmlClass: 'mermaid|language-mermaid'
        }}
    }};
    </script>
    <script src="{mathjax_url}"></script>
    <script src="{mermaid_url}"></script>
    <style>
        @page {{ size: A4; margin: 16mm 14mm; }}
        html, body {{ background: #ffffff !important; }}
        body {{ margin: 0; color: #1f2937; }}
        .pdf-root {{ max-width: none; padding: 0; }}
        .pdf-toc {{ page-break-after: always; break-after: page; margin-bottom: 24px; }}
        .pdf-toc-title {{ margin: 0 0 18px 0; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb; }}
        .pdf-toc-list {{ list-style: none; padding: 0; margin: 0; }}
        .pdf-toc-item {{ margin: 7px 0; line-height: 1.35; }}
        .pdf-toc-item a {{ color: #111827; text-decoration: none; }}
        .pdf-toc-level-1 {{ font-weight: 700; font-size: 16px; margin-top: 12px; }}
        .pdf-toc-level-2 {{ padding-left: 18px; font-size: 14px; }}
        .pdf-toc-level-3 {{ padding-left: 36px; font-size: 13px; }}
        .pdf-toc-level-4 {{ padding-left: 54px; font-size: 12px; }}
        .pdf-toc-level-5 {{ padding-left: 72px; font-size: 12px; }}
        .pdf-toc-level-6 {{ padding-left: 90px; font-size: 12px; }}
        .pdf-document {{ page-break-inside: auto; break-inside: auto; }}
        .pdf-page-break {{ page-break-before: always; break-before: page; }}
        .pdf-document-title {{ margin: 0 0 8px 0; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb; }}
        .pdf-document-path {{ color: #6b7280; font-size: 12px; margin-bottom: 22px; }}
        .markdown-body {{ max-width: none !important; padding: 0 !important; background: #fff !important; }}
        .mermaid-actions, .code-copy-btn, .math-copy-btn {{ display: none !important; }}
        .mermaid-container {{ page-break-inside: avoid; break-inside: avoid; }}
        pre, blockquote, table, img, svg {{ page-break-inside: avoid; break-inside: avoid; }}
        img, svg {{ max-width: 100%; height: auto; }}
        a {{ color: #2563eb; text-decoration: none; }}
    </style>
</head>
<body>
    <main id="previewContent" class="preview-content pdf-root">
        {toc_html}
        {''.join(parts)}
    </main>
    <script>
    const previewContent = document.getElementById('previewContent');

    async function waitFor(predicate, timeoutMs = 15000) {{
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {{
            if (predicate()) return true;
            await new Promise(resolve => setTimeout(resolve, 100));
        }}
        return false;
    }}

    async function renderMermaidDiagramsForPdf() {{
        await waitFor(() => window.mermaid);
        if (!window.mermaid) return;

        mermaid.initialize({{
            startOnLoad: false,
            theme: 'base',
            themeVariables: {{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
                fontSize: '14px',
                background: 'transparent',
                primaryColor: '#dbeafe',
                primaryTextColor: '#1e3a5f',
                primaryBorderColor: '#3b82f6',
                secondaryColor: '#fef3c7',
                tertiaryColor: '#dcfce7',
                lineColor: '#64748b',
                mainBkg: '#dbeafe',
                secondBkg: '#fef3c7',
                tertiaryBkg: '#dcfce7',
                nodeBorder: '#3b82f6',
                clusterBkg: '#f8fafc',
                clusterBorder: '#cbd5e1',
                titleColor: '#1e293b',
                edgeLabelBackground: '#ffffff',
                actorBkg: '#dbeafe',
                actorBorder: '#3b82f6',
                actorTextColor: '#1e3a5f',
                signalColor: '#475569',
                signalTextColor: '#1e293b',
                noteBkgColor: '#fef9c3',
                noteTextColor: '#713f12',
                noteBorderColor: '#facc15',
                pie1: '#3b82f6', pie2: '#10b981', pie3: '#f59e0b', pie4: '#ec4899',
                pie5: '#8b5cf6', pie6: '#06b6d4', pie7: '#f43f5e', pie8: '#84cc16',
                pieStrokeColor: '#ffffff',
                pieOuterStrokeColor: '#cbd5e1',
                sectionBkgColor: '#dbeafe',
                altSectionBkgColor: '#fef3c7',
                gridColor: '#e2e8f0',
                taskBkgColor: '#3b82f6',
                taskTextColor: '#ffffff'
            }},
            securityLevel: 'loose',
            suppressErrorRendering: false,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
            logLevel: 'error',
            flowchart: {{ useMaxWidth: true, htmlLabels: true, curve: 'basis', padding: 18, nodeSpacing: 55, rankSpacing: 60 }},
            sequence: {{ useMaxWidth: true, showSequenceNumbers: false, wrap: true }},
            class: {{ useMaxWidth: true }},
            state: {{ useMaxWidth: true }},
            er: {{ useMaxWidth: true }},
            gantt: {{ useMaxWidth: true, barHeight: 22, barGap: 6 }},
            pie: {{ useMaxWidth: true }},
            journey: {{ useMaxWidth: true }},
            gitGraph: {{ useMaxWidth: true }},
            mindmap: {{ useMaxWidth: true, padding: 12 }},
            timeline: {{ useMaxWidth: true, padding: 12 }},
            sankey: {{ useMaxWidth: true }},
            xyChart: {{ useMaxWidth: true }},
            quadrantChart: {{ useMaxWidth: true }},
            requirement: {{ useMaxWidth: true }},
            block: {{ useMaxWidth: true, padding: 12 }},
            packet: {{ useMaxWidth: true, padding: 12 }},
            architecture: {{ useMaxWidth: true, padding: 12 }},
            kanban: {{ useMaxWidth: true, padding: 12 }}
        }});

        const blocks = Array.from(previewContent.querySelectorAll('pre code.language-mermaid'));
        for (let i = 0; i < blocks.length; i++) {{
            const codeBlock = blocks[i];
            const pre = codeBlock.parentElement;
            const source = codeBlock.textContent.trim();
            const container = document.createElement('div');
            container.className = 'mermaid-container';
            const mermaidDiv = document.createElement('div');
            mermaidDiv.className = 'mermaid';
            container.appendChild(mermaidDiv);
            pre.parentNode.replaceChild(container, pre);

            try {{
                const id = `pdf-mermaid-${{Date.now()}}-${{i}}`;
                const result = await mermaid.render(id, source);
                mermaidDiv.innerHTML = result.svg;
            }} catch (error) {{
                mermaidDiv.innerHTML = `<pre style="color:#b91c1c; white-space:pre-wrap;">Mermaid 渲染失败：${{String(error.message || error)}}\n\n${{source.replace(/[&<>]/g, ch => ({{'&':'&amp;','<':'&lt;','>':'&gt;'}}[ch]))}}</pre>`;
            }}
        }}
    }}

    async function renderMathJaxForPdf() {{
        await waitFor(() => window.MathJax && (window.MathJax.typesetPromise || window.MathJax.startup));
        if (!window.MathJax) return;
        if (window.MathJax.startup && window.MathJax.startup.promise) {{
            await window.MathJax.startup.promise;
        }}
        if (typeof window.MathJax.typesetPromise === 'function') {{
            await window.MathJax.typesetPromise([previewContent]);
        }}
    }}

    window.__MARKINOTE_PDF_READY__ = false;
    window.__MARKINOTE_PDF_ERROR__ = null;
    (async () => {{
        try {{
            await renderMermaidDiagramsForPdf();
            await renderMathJaxForPdf();
            if (document.fonts && document.fonts.ready) await document.fonts.ready;
            window.__MARKINOTE_PDF_READY__ = true;
        }} catch (error) {{
            window.__MARKINOTE_PDF_ERROR__ = String(error && error.stack || error);
            window.__MARKINOTE_PDF_READY__ = true;
        }}
    }})();
    </script>
</body>
</html>'''


def _launch_chromium(playwright):
    """启动 Chromium/Chrome/Edge。优先使用外部浏览器，避免打包内置 Chromium。"""
    args = ['--no-sandbox', '--disable-dev-shm-usage']
    executable_path = os.environ.get('MARKINOTE_CHROMIUM_EXECUTABLE')
    if executable_path:
        return playwright.chromium.launch(executable_path=executable_path, headless=True, args=args)

    channel_env = os.environ.get('MARKINOTE_BROWSER_CHANNELS')
    channels = [c.strip() for c in channel_env.split(',')] if channel_env else [
        'msedge',
        'chrome',
        'chromium',
    ]
    last_error: Exception | None = None
    for channel in channels:
        if not channel:
            continue
        try:
            return playwright.chromium.launch(channel=channel, headless=True, args=args)
        except Exception as exc:  # noqa: BLE001 - 需要逐个探测本机浏览器
            last_error = exc
            logger.debug('Browser channel unavailable: %s (%s)', channel, exc)

    try:
        return playwright.chromium.launch(headless=True, args=args)
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(
            '没有找到可用于 PDF 导出的 Chromium/Chrome/Edge。'
            '请安装 Chrome/Edge，或执行 `uv run playwright install chromium`，'
            '或设置 MARKINOTE_CHROMIUM_EXECUTABLE 指向浏览器可执行文件。'
        ) from (last_error or exc)


def render_pdf_bytes(
    documents: Iterable[PdfDocument],
    *,
    title: str = 'MarkiNote Export',
    static_base_url: str = '',
) -> bytes:
    """用真实浏览器渲染并打印 PDF 字节。"""
    html_content = build_browser_pdf_html(documents, title=title, static_base_url=static_base_url)

    try:
        with sync_playwright() as playwright:
            browser = _launch_chromium(playwright)
            try:
                page = browser.new_page(viewport={'width': 1280, 'height': 1800}, device_scale_factor=1)
                page.set_content(html_content, wait_until='networkidle', timeout=60000)
                page.wait_for_function(
                    'window.__MARKINOTE_PDF_READY__ === true',
                    timeout=int(os.environ.get('MARKINOTE_PDF_RENDER_TIMEOUT_MS', '60000')),
                )
                pdf_error = page.evaluate('window.__MARKINOTE_PDF_ERROR__')
                if pdf_error:
                    logger.warning('PDF browser render warning: %s', pdf_error)
                return page.pdf(
                    format='A4',
                    print_background=True,
                    prefer_css_page_size=True,
                    margin={'top': '16mm', 'right': '14mm', 'bottom': '16mm', 'left': '14mm'},
                    outline=True,
                    tagged=True,
                )
            finally:
                browser.close()
    except PlaywrightError as exc:
        raise RuntimeError(f'浏览器 PDF 渲染失败: {exc}') from exc
