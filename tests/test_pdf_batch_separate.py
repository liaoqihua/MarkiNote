import io
import unittest
import zipfile
from unittest.mock import patch

from app import create_app


class SeparatePdfExportTests(unittest.TestCase):
    def test_batch_separate_export_returns_zip_with_one_pdf_per_document(self):
        app = create_app()
        client = app.test_client()

        def fake_render_pdf_bytes(docs, **kwargs):
            title = list(docs)[0].title
            return f'%PDF fake {title}'.encode('utf-8')

        with patch('app.routes.pdf_routes.render_pdf_bytes', side_effect=fake_render_pdf_bytes):
            response = client.post('/api/export/pdf/batch/separate', json={
                'paths': ['Welcome.md', 'Welcome-EN.md']
            })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, 'application/zip')
        self.assertIn('MarkiNote-PDFs.zip', response.headers.get('Content-Disposition', ''))

        with zipfile.ZipFile(io.BytesIO(response.data)) as archive:
            names = archive.namelist()
            self.assertEqual(names, ['Welcome.pdf', 'Welcome-EN.pdf'])
            self.assertTrue(archive.read('Welcome.pdf').startswith(b'%PDF'))
            self.assertTrue(archive.read('Welcome-EN.pdf').startswith(b'%PDF'))


if __name__ == '__main__':
    unittest.main()
