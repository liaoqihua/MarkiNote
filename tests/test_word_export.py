"""Word 导出相关单元测试。"""
from __future__ import annotations

import io
import unittest
import zipfile
from unittest.mock import patch

from app import create_app
from app.utils.word_utils import (
    WordDocument,
    _render_mermaid_blocks,
    convert_html_to_docx,
    render_word_bytes,
)


class WordUtilsTests(unittest.TestCase):
    def test_convert_html_to_docx_creates_heading_paragraph_table_list(self):
        html = '''
        <div class="markdown-body">
            <h1>一级标题</h1>
            <p>普通段落，包含 <strong>粗体</strong> 与 <em>斜体</em>。</p>
            <ul>
                <li>项目一</li>
                <li>项目二</li>
            </ul>
            <table>
                <tr><th>列A</th><th>列B</th></tr>
                <tr><td>1</td><td>2</td></tr>
            </table>
            <pre><code class="language-python">print("hello")</code></pre>
        </div>
        '''
        document = convert_html_to_docx(html, title='Test')

        # 统计段落与表格
        paragraphs = [p for p in document.paragraphs if p.text.strip()]
        tables = document.tables

        self.assertTrue(any('一级标题' in p.text for p in paragraphs))
        self.assertTrue(any('普通段落' in p.text for p in paragraphs))
        self.assertEqual(len(tables), 2)  # 一个普通表格 + 一个代码块表格

    def test_render_word_bytes_for_single_document(self):
        doc = WordDocument(
            path='note.md',
            title='note.md',
            markdown='# Hello\n\nWorld',
            html='<h1>Hello</h1><p>World</p>',
        )
        data = render_word_bytes([doc])
        self.assertTrue(data.startswith(b'PK'))  # docx 本质是 zip

    def test_render_word_bytes_for_multiple_documents(self):
        docs = [
            WordDocument(path='a.md', title='a.md', markdown='# A', html='<h1>A</h1>'),
            WordDocument(path='b.md', title='b.md', markdown='# B', html='<h1>B</h1>'),
        ]
        data = render_word_bytes(docs)
        self.assertTrue(data.startswith(b'PK'))

    def test_inline_formatting_in_table_cells(self):
        html = '''
        <div class="markdown-body">
            <table>
                <tr><td>单元格 <strong>粗体</strong> 和 <code>代码</code></td></tr>
            </table>
        </div>
        '''
        document = convert_html_to_docx(html)
        self.assertEqual(len(document.tables), 1)
        cell = document.tables[0].rows[0].cells[0]
        runs = [run for p in cell.paragraphs for run in p.runs if run.text]
        bold_runs = [run for run in runs if run.bold]
        code_runs = [run for run in runs if run.font.name == 'Courier New']
        self.assertTrue(any('粗体' in run.text for run in bold_runs))
        self.assertTrue(any('代码' in run.text for run in code_runs))

    def test_inline_formatting_in_list_items(self):
        html = '''
        <div class="markdown-body">
            <ul>
                <li>列表项 <strong>粗体</strong> 和 <code>代码</code></li>
            </ul>
        </div>
        '''
        document = convert_html_to_docx(html)
        list_paragraphs = [p for p in document.paragraphs if p.text.strip()]
        self.assertTrue(any('粗体' in p.text for p in list_paragraphs))
        runs = [run for p in list_paragraphs for run in p.runs if run.text]
        bold_runs = [run for run in runs if run.bold]
        code_runs = [run for run in runs if run.font.name == 'Courier New']
        self.assertTrue(any('粗体' in run.text for run in bold_runs))
        self.assertTrue(any('代码' in run.text for run in code_runs))

    def test_code_block_with_syntax_highlighting_keeps_line_breaks(self):
        """codehilite 高亮会在 <code> 内生成大量 <span>，应保留原始换行而不是每个 span 后换行。"""
        html = '''
        <pre style="position: relative;"><span></span><code><span class="c1">// Key</span>
<span class="n">QMap</span><span class="o">&lt;</span><span class="n">QString</span><span class="p">,</span><span class="w"> </span><span class="n">ForwardMapping</span><span class="o">&gt;</span><span class="w"> </span><span class="n">m</span><span class="p">;</span>
<span class="k">struct</span><span class="w"> </span><span class="nc">ForwardMapping</span><span class="w"> </span><span class="p">{</span>
<span class="w">    </span><span class="kt">int</span><span class="w"> </span><span class="n">nChannelID</span><span class="p">;</span>
<span class="p">};</span>
</code><button class="code-copy-btn">...</button></pre>
        '''
        document = convert_html_to_docx(html)
        self.assertEqual(len(document.tables), 1)
        cell = document.tables[0].rows[0].cells[0]
        text = cell.text
        # 应包含 4 个逻辑行（空行也算一行），而不是每个 span 后都换行导致大量行
        self.assertIn('QMap<QString, ForwardMapping>', text)
        self.assertIn('struct ForwardMapping', text)
        self.assertLess(text.count('\n'), 10)

    def test_mermaid_blocks_replaced_with_images(self):
        html = '''
        <div class="markdown-body">
            <pre><code class="language-mermaid">graph LR; A --> B;</code></pre>
            <p>after</p>
        </div>
        '''

        def fake_screenshot(browser, fragment, count):
            return [b'\x89PNG\r\n\x1a\n' + b'fake'] * count

        with patch('app.utils.word_utils._capture_mermaid_screenshots', side_effect=fake_screenshot):
            result = _render_mermaid_blocks(html)

        self.assertNotIn('language-mermaid', result)
        self.assertIn('data:image/png;base64', result)
        self.assertIn('after', result)


class WordExportRouteTests(unittest.TestCase):
    def test_single_word_export_returns_docx(self):
        app = create_app()
        client = app.test_client()

        fake_docx = b'PK fake docx'

        def fake_render_word_bytes(docs, **kwargs):
            return fake_docx

        with patch('app.routes.word_routes.render_word_bytes', side_effect=fake_render_word_bytes):
            response = client.post('/api/export/word', json={'path': 'Welcome.md'})

        self.assertEqual(response.status_code, 200)
        self.assertIn(
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            response.mimetype,
        )
        self.assertIn('Welcome.docx', response.headers.get('Content-Disposition', ''))
        self.assertEqual(response.data, fake_docx)

    def test_batch_separate_word_export_returns_zip(self):
        app = create_app()
        client = app.test_client()

        def fake_render_word_bytes(docs, **kwargs):
            title = list(docs)[0].title
            return f'PK fake {title}'.encode('utf-8')

        with patch('app.routes.word_routes.render_word_bytes', side_effect=fake_render_word_bytes):
            response = client.post('/api/export/word/batch/separate', json={
                'paths': ['Welcome.md', 'Welcome-EN.md']
            })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, 'application/zip')
        self.assertIn('MarkiNote-Words.zip', response.headers.get('Content-Disposition', ''))

        with zipfile.ZipFile(io.BytesIO(response.data)) as archive:
            names = archive.namelist()
            self.assertEqual(names, ['Welcome.docx', 'Welcome-EN.docx'])
            self.assertTrue(archive.read('Welcome.docx').startswith(b'PK'))


if __name__ == '__main__':
    unittest.main()
