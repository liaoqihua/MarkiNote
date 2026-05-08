import unittest

from app.utils.pdf_utils import PdfDocument, build_browser_pdf_html, extract_toc_entries


class PdfTocTests(unittest.TestCase):
    def test_extract_toc_entries_from_markdown_headings(self):
        doc = PdfDocument(
            path='note.md',
            title='note.md',
            markdown='',
            html='<h1>一级标题</h1><p>x</p><h2 id="custom-id">二级标题</h2><h3>三级标题</h3>',
        )

        entries = extract_toc_entries([doc])

        self.assertEqual(
            [(entry.level, entry.title, entry.anchor) for entry in entries],
            [(1, '一级标题', 'doc-1-heading-1'), (2, '二级标题', 'custom-id'), (3, '三级标题', 'doc-1-heading-3')]
        )

    def test_export_html_contains_visible_table_of_contents(self):
        doc = PdfDocument(
            path='note.md',
            title='note.md',
            markdown='',
            html='<h1>一级标题</h1><h2>二级标题</h2>',
        )

        html = build_browser_pdf_html([doc], static_base_url='http://127.0.0.1:5000')

        self.assertIn('class="pdf-toc"', html)
        self.assertIn('目录', html)
        self.assertIn('href="#doc-1-heading-1"', html)
        self.assertIn('一级标题', html)
        self.assertIn('href="#doc-1-heading-2"', html)
        self.assertIn('二级标题', html)


if __name__ == '__main__':
    unittest.main()
