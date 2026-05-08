"""PDF 导出路由。"""
from __future__ import annotations

import io
import logging
import zipfile
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request, send_file

from app.utils.pdf_utils import read_pdf_document, render_pdf_bytes, slugify_filename

pdf_bp = Blueprint('pdf', __name__)
logger = logging.getLogger(__name__)


def _json_error(message: str, status: int = 400):
    return jsonify({'success': False, 'error': message}), status


def _unique_paths(paths):
    """去重但保持用户选择顺序。"""
    unique_paths = []
    seen = set()
    for path in paths:
        if isinstance(path, str) and path not in seen:
            unique_paths.append(path)
            seen.add(path)
    return unique_paths


@pdf_bp.route('/api/export/pdf', methods=['POST'])
def export_single_pdf():
    """将单个文档导出为 PDF。"""
    data = request.get_json(silent=True) or {}
    rel_path = data.get('path', '')

    try:
        doc = read_pdf_document(current_app.config['LIBRARY_FOLDER'], rel_path)
        pdf_bytes = render_pdf_bytes([doc], title=doc.title, static_base_url=request.host_url)
        filename = slugify_filename(doc.title)
        logger.info('Exported PDF: %s', doc.path)
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename,
        )
    except FileNotFoundError as exc:
        return _json_error(str(exc), 404)
    except ValueError as exc:
        return _json_error(str(exc), 400)
    except Exception as exc:
        logger.exception('PDF export failed: %s', rel_path)
        return _json_error(f'PDF 导出失败: {exc}', 500)


@pdf_bp.route('/api/export/pdf/batch', methods=['POST'])
def export_batch_pdf():
    """将任意数量文档合并导出为一个 PDF。"""
    data = request.get_json(silent=True) or {}
    paths = data.get('paths', [])

    if not isinstance(paths, list):
        return _json_error('paths 必须是数组', 400)

    # 去重但保持用户选择顺序
    unique_paths = _unique_paths(paths)

    if not unique_paths:
        return _json_error('请至少选择一个文档', 400)

    try:
        docs = [read_pdf_document(current_app.config['LIBRARY_FOLDER'], path) for path in unique_paths]
        pdf_bytes = render_pdf_bytes(docs, title='MarkiNote Export', static_base_url=request.host_url)
        filename = slugify_filename('MarkiNote-Export.pdf')
        logger.info('Exported merged PDF: %d docs', len(docs))
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename,
        )
    except FileNotFoundError as exc:
        return _json_error(str(exc), 404)
    except ValueError as exc:
        return _json_error(str(exc), 400)
    except Exception as exc:
        logger.exception('Batch PDF export failed: %s', unique_paths)
        return _json_error(f'PDF 导出失败: {exc}', 500)

@pdf_bp.route('/api/export/pdf/batch/separate', methods=['POST'])
def export_batch_separate_pdf():
    """将任意数量文档分别导出为 PDF，并打包成 zip 下载。"""
    data = request.get_json(silent=True) or {}
    paths = data.get('paths', [])

    if not isinstance(paths, list):
        return _json_error('paths 必须是数组', 400)

    unique_paths = _unique_paths(paths)
    if not unique_paths:
        return _json_error('请至少选择一个文档', 400)

    try:
        docs = [read_pdf_document(current_app.config['LIBRARY_FOLDER'], path) for path in unique_paths]
        zip_buffer = io.BytesIO()
        used_names = set()

        with zipfile.ZipFile(zip_buffer, mode='w', compression=zipfile.ZIP_DEFLATED) as archive:
            for index, doc in enumerate(docs, start=1):
                pdf_bytes = render_pdf_bytes([doc], title=doc.title, static_base_url=request.host_url)
                filename = slugify_filename(doc.title)
                if filename in used_names:
                    stem = Path(filename).stem
                    suffix = Path(filename).suffix or '.pdf'
                    filename = f'{stem}-{index}{suffix}'
                used_names.add(filename)
                archive.writestr(filename, pdf_bytes)

        zip_buffer.seek(0)
        logger.info('Exported separate PDFs zip: %d docs', len(docs))
        return send_file(
            zip_buffer,
            mimetype='application/zip',
            as_attachment=True,
            download_name='MarkiNote-PDFs.zip',
        )
    except FileNotFoundError as exc:
        return _json_error(str(exc), 404)
    except ValueError as exc:
        return _json_error(str(exc), 400)
    except Exception as exc:
        logger.exception('Separate PDF export failed: %s', unique_paths)
        return _json_error(f'PDF 导出失败: {exc}', 500)

