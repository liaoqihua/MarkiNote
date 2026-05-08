"""MarkiNote - Markdown 文档管理系统启动文件"""
from __future__ import annotations

import argparse
import logging
import os
import threading
import webbrowser

from app import create_app
from app.runtime import get_data_dir, get_log_dir, is_frozen, setup_logging


logger = logging.getLogger(__name__)
app = create_app()


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """解析启动参数。"""
    parser = argparse.ArgumentParser(description='启动 MarkiNote 本地 Web 应用')
    browser_group = parser.add_mutually_exclusive_group()
    browser_group.add_argument(
        '--open-browser',
        dest='open_browser',
        action='store_true',
        default=None,
        help='启动后自动打开浏览器（默认关闭）',
    )
    browser_group.add_argument(
        '--no-browser',
        dest='open_browser',
        action='store_false',
        help='启动后不自动打开浏览器',
    )
    parser.add_argument('--host', default=None, help='监听地址，默认读取 MARKINOTE_HOST 或 127.0.0.1')
    parser.add_argument('--port', type=int, default=None, help='监听端口，默认读取 MARKINOTE_PORT 或 5000')
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument('--debug', action='store_true', help='开发模式：使用 Flask 内置开发服务器（脚本运行时默认）')
    mode_group.add_argument('--production', action='store_true', help='生产模式：使用 waitress 生产级 WSGI 服务器（打包后默认）')
    return parser.parse_args(argv)


def should_open_browser(args: argparse.Namespace) -> bool:
    """判断本次启动是否自动打开浏览器（默认不打开）。"""
    if args.open_browser is not None:
        return bool(args.open_browser)
    return os.environ.get("MARKINOTE_OPEN_BROWSER") == "1"


def _open_browser(url: str, enabled: bool = True) -> None:
    """延迟打开浏览器，避免 Flask 还没启动就访问。"""
    if not enabled:
        return
    timer = threading.Timer(1.0, lambda: webbrowser.open(url))
    timer.daemon = True
    timer.start()


def run(argv: list[str] | None = None) -> None:
    """启动 MarkiNote。"""
    args = parse_args(argv)
    log_file = setup_logging()

    host = args.host or os.environ.get("MARKINOTE_HOST", "127.0.0.1")
    port = args.port or int(os.environ.get("MARKINOTE_PORT", "5000"))

    # 运行模式判定：
    #   - 打包后（PyInstaller frozen）默认生产模式（waitress）；
    #   - 以脚本方式运行（python main.py）默认开发模式（Flask dev server）；
    #   - 可通过 --debug / --production 或 MARKINOTE_DEBUG=1 显式覆盖。
    env_debug = os.environ.get("MARKINOTE_DEBUG", "0") == "1"
    if args.production:
        debug = False
        use_production_server = True
    elif args.debug or env_debug:
        debug = True
        use_production_server = False
    else:
        debug = False
        use_production_server = is_frozen()

    open_browser = should_open_browser(args)
    url = f"http://localhost:{port}"

    print("🚀 MarkiNote 启动中...")
    print(f"📝 访问 {url} 使用应用")
    print(f"📁 数据目录: {get_data_dir()}")
    print(f"📚 文档库目录: {app.config['LIBRARY_FOLDER']}")
    print(f"🗂️ 日志目录: {get_log_dir()}")
    print(f"📄 日志文件: {log_file}")
    print(f"🌐 自动打开浏览器: {'是' if open_browser else '否'}")
    print("💡 支持的功能：Markdown 预览、文件管理、数学公式、代码高亮")

    logger.info("MarkiNote starting: host=%s port=%s debug=%s open_browser=%s production=%s",
                host, port, debug, open_browser, use_production_server)
    logger.info("Data directory: %s", get_data_dir())
    logger.info("Library directory: %s", app.config['LIBRARY_FOLDER'])
    logger.info("Log directory: %s", get_log_dir())
    logger.info("Log file: %s", log_file)

    _open_browser(url, enabled=open_browser)

    if use_production_server:
        try:
            from waitress import serve
        except ImportError:
            logger.warning("waitress 未安装，回退到 Flask 开发服务器；请安装 waitress 以获得生产级性能。")
            app.run(debug=debug, host=host, port=port, use_reloader=False)
            return

        threads = int(os.environ.get("MARKINOTE_THREADS", "8"))
        print(f"🛡  生产模式：使用 waitress 启动（threads={threads}）")
        logger.info("Serving via waitress on %s:%s (threads=%s)", host, port, threads)
        serve(app, host=host, port=port, threads=threads, ident="MarkiNote")
    else:
        print("🧪 开发模式：使用 Flask 内置开发服务器")
        logger.info("Serving via Flask development server (debug=%s)", debug)
        app.run(debug=debug, host=host, port=port, use_reloader=False)


if __name__ == '__main__':
    run()
