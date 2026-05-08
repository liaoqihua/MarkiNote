"""MarkiNote - Markdown 文档管理系统启动文件"""
from __future__ import annotations

import logging
import os
import threading
import webbrowser

from app import create_app
from app.runtime import get_data_dir, get_log_dir, setup_logging


logger = logging.getLogger(__name__)
app = create_app()


def _open_browser(url: str) -> None:
    """延迟打开浏览器，避免 Flask 还没启动就访问。"""
    if os.environ.get("MARKINOTE_NO_BROWSER") == "1":
        return
    timer = threading.Timer(1.0, lambda: webbrowser.open(url))
    timer.daemon = True
    timer.start()


def run() -> None:
    """启动 MarkiNote。"""
    log_file = setup_logging()

    host = os.environ.get("MARKINOTE_HOST", "127.0.0.1")
    port = int(os.environ.get("MARKINOTE_PORT", "5000"))
    debug = os.environ.get("MARKINOTE_DEBUG", "0") == "1"
    url = f"http://localhost:{port}"

    print("🚀 MarkiNote 启动中...")
    print(f"📝 访问 {url} 使用应用")
    print(f"📁 数据目录: {get_data_dir()}")
    print(f"📚 文档库目录: {app.config['LIBRARY_FOLDER']}")
    print(f"🗂️ 日志目录: {get_log_dir()}")
    print(f"📄 日志文件: {log_file}")
    print("💡 支持的功能：Markdown 预览、文件管理、数学公式、代码高亮")

    logger.info("MarkiNote starting: host=%s port=%s debug=%s", host, port, debug)
    logger.info("Data directory: %s", get_data_dir())
    logger.info("Library directory: %s", app.config['LIBRARY_FOLDER'])
    logger.info("Log directory: %s", get_log_dir())
    logger.info("Log file: %s", log_file)

    _open_browser(url)
    app.run(debug=debug, host=host, port=port, use_reloader=False)


if __name__ == '__main__':
    run()
