"""Word 导出路由。"""
from __future__ import annotations

import io
import logging
import zipfile
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request, send_file

from app.utils.word_utils import read_word_document, render_word_bytes, slugify_filename

word_bp = Blueprint('word', __name__)
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


@word_bp.route('/api/export/word', methods=['POST'])
def export_single_word():
    """将单个文档导出为 Word。"""
    data = request.get_json(silent=True) or {}
    rel_path = data.get('path', '')

    try:
        doc = read_word_document(current_app.config['LIBRARY_FOLDER'], rel_path)
        word_bytes = render_word_bytes([doc], title=doc.title)
        filename = slugify_filename(doc.title)
        logger.info('Exported Word: %s', doc.path)
        return send_file(
            io.BytesIO(word_bytes),
            mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            as_attachment=True,
            download_name=filename,
        )
    except FileNotFoundError as exc:
        return _json_error(str(exc), 404)
    except ValueError as exc:
        return _json_error(str(exc), 400)
    except Exception as exc:
        logger.exception('Word export failed: %s', rel_path)
        return _json_error(f'Word 导出失败: {exc}', 500)


@word_bp.route('/api/export/word/batch', methods=['POST'])
def export_batch_word():
    """将任意数量文档合并导出为一个 Word。"""
    data = request.get_json(silent=True) or {}
    paths = data.get('paths', [])

    if not isinstance(paths, list):
        return _json_error('paths 必须是数组', 400)

    unique_paths = _unique_paths(paths)
    if not unique_paths:
        return _json_error('请至少选择一个文档', 400)

    try:
        docs = [read_word_document(current_app.config['LIBRARY_FOLDER'], path) for path in unique_paths]
        word_bytes = render_word_bytes(docs, title='MarkiNote Export')
        filename = slugify_filename('MarkiNote-Export.docx')
        logger.info('Exported merged Word: %d docs', len(docs))
        return send_file(
            io.BytesIO(word_bytes),
            mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            as_attachment=True,
            download_name=filename,
        )
    except FileNotFoundError as exc:
        return _json_error(str(exc), 404)
    except ValueError as exc:
        return _json_error(str(exc), 400)
    except Exception as exc:
        logger.exception('Batch Word export failed: %s', unique_paths)
        return _json_error(f'Word 导出失败: {exc}', 500)


@word_bp.route('/api/export/word/batch/separate', methods=['POST'])
def export_batch_separate_word():
    """将任意数量文档分别导出为 Word，并打包成 zip 下载。"""
    data = request.get_json(silent=True) or {}
    paths = data.get('paths', [])

    if not isinstance(paths, list):
        return _json_error('paths 必须是数组', 400)

    unique_paths = _unique_paths(paths)
    if not unique_paths:
        return _json_error('请至少选择一个文档', 400)

    try:
        docs = [read_word_document(current_app.config['LIBRARY_FOLDER'], path) for path in unique_paths]
        zip_buffer = io.BytesIO()
        used_names = set()

        with zipfile.ZipFile(zip_buffer, mode='w', compression=zipfile.ZIP_DEFLATED) as archive:
            for index, doc in enumerate(docs, start=1):
                word_bytes = render_word_bytes([doc], title=doc.title)
                filename = slugify_filename(doc.title)
                if filename in used_names:
                    stem = Path(filename).stem
                    suffix = Path(filename).suffix or '.docx'
                    filename = f'{stem}-{index}{suffix}'
                used_names.add(filename)
                archive.writestr(filename, word_bytes)

        zip_buffer.seek(0)
        logger.info('Exported separate Words zip: %d docs', len(docs))
        return send_file(
            zip_buffer,
            mimetype='application/zip',
            as_attachment=True,
            download_name='MarkiNote-Words.zip',
        )
    except FileNotFoundError as exc:
        return _json_error(str(exc), 404)
    except ValueError as exc:
        return _json_error(str(exc), 400)
    except Exception as exc:
        logger.exception('Separate Word export failed: %s', unique_paths)
        return _json_error(f'Word 导出失败: {exc}', 500)
