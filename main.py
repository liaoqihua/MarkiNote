"""MarkiNote - Markdown 文档管理系统启动文件"""
from __future__ import annotations

import argparse
import json
import logging
import os
import signal
import subprocess
import sys
import threading
import time
import webbrowser

from app import create_app
from app.runtime import (
    get_data_dir,
    get_log_dir,
    get_pid_file,
    is_frozen,
    is_process_running,
    read_pid_file,
    remove_pid_file,
    setup_logging,
    write_pid_file,
)


logger = logging.getLogger(__name__)
app = create_app()


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """解析启动参数。"""
    parser = argparse.ArgumentParser(
        description='启动 MarkiNote 本地 Web 应用',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            '后台运行模式:\n'
            '  MarkiNote on      启动后台运行\n'
            '  MarkiNote off     关闭后台运行\n'
            '  MarkiNote         交互式运行（默认）\n'
        ),
    )
    parser.add_argument(
        'mode', nargs='?', choices=['on', 'off'], default=None,
        help='on=后台启动  off=关闭后台  不指定=交互模式',
    )
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


# ---------------------------------------------------------------------------
# 后台运行模式管理
# ---------------------------------------------------------------------------

def _stop_background(pid: int | None) -> None:
    """关闭后台运行的 MarkiNote 进程。"""
    if pid is None:
        print("MarkiNote 当前未在后台运行。")
        return

    if not is_process_running(pid):
        print(f"PID {pid} 对应的进程已不存在，正在清理 PID 文件...")
        remove_pid_file()
        return

    try:
        os.kill(pid, signal.SIGTERM)
        print(f"已发送终止信号到 MarkiNote (PID: {pid})")

        # 等待进程优雅退出（最多 5 秒）
        for _ in range(50):
            time.sleep(0.1)
            if not is_process_running(pid):
                print("MarkiNote 已停止运行。")
                break
        else:
            # 超时则强制终止
            if is_process_running(pid):
                if not sys.platform.startswith("win"):
                    os.kill(pid, signal.SIGKILL)
                else:
                    os.kill(pid, signal.SIGTERM)  # Windows 上 SIGTERM ≈ TerminateProcess
                print("MarkiNote 已被强制终止。")
    except OSError as exc:
        print(f"无法终止进程 PID={pid}: {exc}")
    finally:
        remove_pid_file()


def _daemonize_unix() -> None:
    """Unix/Linux: 使用 subprocess 启动独立的后台进程。

    不使用 fork——避免 PyInstaller onefile 下 _MEIPASS 继承问题。
    子进程作为全新进程启动，拥有自己独立的 PyInstaller 运行时环境。
    """
    # 构建不含 'on' 的参数列表（子进程以交互模式运行）
    other_args = [a for a in sys.argv[1:] if a != "on"]
    if is_frozen():
        # PyInstaller onefile: sys.executable 即为脚本本身
        new_argv = [sys.executable] + other_args
    else:
        # 源码运行: 需要 Python 解释器 + 脚本路径
        new_argv = [sys.executable, sys.argv[0]] + other_args

    # 传递 MARKINOTE_BACKGROUND 环境变量，让子进程知道它运行在后台
    env = os.environ.copy()
    env["MARKINOTE_BACKGROUND"] = "1"

    # 关键：清理 PyInstaller bootloader 泄漏的环境变量。
    # 父 PyInstaller 进程启动时会设置这些变量指向自己的 _MEIPASS，
    # 若子进程继承，会导致子进程加载父进程的临时文件/动态库，
    # 当父进程退出并清理 _MEIPASS 时，子进程会崩溃。
    for _key in (
        "_MEIPASS2",              # 新 bootloader 会复用此目录，跳过解包
        "_PYI_APPLICATION_HOME_DIR",
        "_PYI_PARENT_PROCESS_LEVEL",
        "LD_LIBRARY_PATH",        # 父进程的共享库路径
        "DYLD_LIBRARY_PATH",
        "DYLD_INSERT_LIBRARIES",
    ):
        env.pop(_key, None)
    # 恢复 PyInstaller 保存的原始 LD_LIBRARY_PATH
    _orig_ld = env.pop("LD_LIBRARY_PATH_ORIG", None)
    if _orig_ld:
        env["LD_LIBRARY_PATH"] = _orig_ld
    _orig_dyld = env.pop("DYLD_LIBRARY_PATH_ORIG", None)
    if _orig_dyld:
        env["DYLD_LIBRARY_PATH"] = _orig_dyld

    try:
        subprocess.Popen(
            new_argv,
            env=env,
            start_new_session=True,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception as exc:
        print(f"无法启动后台进程: {exc}")
        sys.exit(1)

    # 等待子进程写入 PID 文件
    pid_file = get_pid_file()
    for _ in range(30):  # 最多等 3 秒
        time.sleep(0.1)
        pid = read_pid_file()
        if pid is not None:
            print(f"MarkiNote 已在后台启动 (PID: {pid})")
            return

    print("MarkiNote 后台启动失败，请检查日志文件。")
    sys.exit(1)


def _start_background_windows(original_argv: list[str]) -> None:
    """Windows: 使用 subprocess 启动分离的后台进程。"""
    # 构建不含 'on' 的参数列表
    other_args = [a for a in sys.argv[1:] if a != "on"]
    if is_frozen():
        new_argv = [sys.executable] + other_args
    else:
        new_argv = [sys.executable, sys.argv[0]] + other_args

    # 传递 MARKINOTE_BACKGROUND 环境变量，让子进程知道它运行在后台
    env = os.environ.copy()
    env["MARKINOTE_BACKGROUND"] = "1"

    DETACHED_PROCESS = 0x00000008
    CREATE_NO_WINDOW = 0x08000000

    try:
        subprocess.Popen(
            new_argv,
            env=env,
            creationflags=DETACHED_PROCESS | CREATE_NO_WINDOW,
            close_fds=True,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception as exc:
        print(f"无法启动后台进程: {exc}")
        sys.exit(1)

    # 等待子进程写入 PID 文件
    pid_file = get_pid_file()
    for _ in range(30):  # 最多等 3 秒
        time.sleep(0.1)
        if pid_file.exists():
            pid = read_pid_file()
            if pid is not None:
                print(f"MarkiNote 已在后台启动 (PID: {pid})")
                return

    print("MarkiNote 后台启动失败，请检查日志文件。")
    sys.exit(1)


def handle_background_mode(args: argparse.Namespace, original_argv: list[str]) -> bool:
    """处理后台运行模式。

    Returns:
        True:  当前进程应继续执行 run()（交互模式或守护进程子进程）
        False: 当前进程应退出（off 模式或 on 模式下父进程已 fork）
    """
    # ----- off：关闭后台进程 -----
    if args.mode == "off":
        pid = read_pid_file()
        _stop_background(pid)
        return False

    # ----- 交互模式 -----
    if args.mode is None:
        return True

    # ----- on：启动后台进程 -----
    # 检查是否已在运行
    pid = read_pid_file()
    if pid is not None and is_process_running(pid):
        print(f"MarkiNote 已在后台运行 (PID: {pid})")
        return False
    if pid is not None:
        # 清理过期的 PID 文件
        remove_pid_file()

    if sys.platform.startswith("win"):
        _start_background_windows(original_argv)
        return False
    else:
        _daemonize_unix()
        # 子进程已通过 subprocess 独立启动，父进程退出
        return False


def run(argv: list[str] | None = None) -> None:
    """启动 MarkiNote。"""
    args = parse_args(argv)

    # 处理后台运行模式（on/off）；交互模式直接继续
    if not handle_background_mode(args, sys.argv):
        sys.exit(0)

    # 判断是否为后台模式（通过 MARKINOTE_BACKGROUND 环境变量识别）
    is_background = os.environ.get("MARKINOTE_BACKGROUND") == "1"

    # 后台模式下写入 PID 文件（子进程启动后写入）
    if is_background:
        write_pid_file()

    host = args.host or os.environ.get("MARKINOTE_HOST", "127.0.0.1")
    port = args.port or int(os.environ.get("MARKINOTE_PORT", "5000"))

    # 运行模式判定：
    #   - 打包后（PyInstaller frozen）默认生产模式（waitress + INFO 日志）；
    #   - 以脚本方式运行（python main.py）默认开发模式（Flask dev server + DEBUG 日志）；
    #   - 可通过 --debug / --production 或 MARKINOTE_DEBUG=1 显式覆盖。
    env_debug = os.environ.get("MARKINOTE_DEBUG", "0") == "1"
    if args.production:
        debug = False
        use_production_server = True
    elif args.debug or env_debug:
        debug = True
        use_production_server = False
    else:
        debug = not is_frozen()
        use_production_server = is_frozen()

    log_file = setup_logging(debug=debug, background=is_background)

    open_browser = should_open_browser(args) and not is_background
    url = f"http://localhost:{port}"

    logger.info("🚀 MarkiNote 启动中...")
    logger.info("📝 访问 %s 使用应用", url)
    logger.info("📁 数据目录: %s", get_data_dir())
    logger.info("📚 文档库目录: %s", app.config['LIBRARY_FOLDER'])
    logger.info("🖼️ 图片存储目录: 与 Markdown 文件同级的 .assets/ 子目录（编辑模式下粘贴的图片会自动保存于此）")
    logger.info("🗂️ 日志目录: %s", get_log_dir())
    logger.info("📄 日志文件: %s", log_file)
    logger.info("🌐 自动打开浏览器: %s", "是" if open_browser else "否")
    logger.info("💡 支持的功能：Markdown 预览、文件管理、数学公式、代码高亮")

    # 打印 AI 配置信息
    from app.utils.ai_provider import PROVIDERS
    providers_info = {k: [m['name'] for m in v['models']] for k, v in PROVIDERS.items()}
    logger.info("🤖 AI 提供商: %s", ", ".join(f"{k}({', '.join(v)})" for k, v in providers_info.items()))

    settings_path = os.path.join(app.config['DATA_DIR'], 'ai_settings.json')
    if os.path.exists(settings_path):
        try:
            with open(settings_path, 'r', encoding='utf-8') as f:
                settings = json.load(f)
            provider = settings.get('provider', '未设置')
            model = settings.get('model', '未设置')
            has_key = bool(settings.get('api_key', ''))
            logger.info("🔑 AI 当前设置: provider=%s model=%s api_key=%s",
                        provider, model, "已配置" if has_key else "未配置")
        except Exception:
            logger.warning("⚠️ AI 配置文件读取失败")
    else:
        logger.info("🔑 AI 配置: 未设置（请在应用内配置 API Key）")

    logger.info("💬 AI 对话记录: %s", app.config['CONVERSATIONS_DIR'])
    logger.info("📦 AI 备份数据: %s", app.config['BACKUPS_DIR'])

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
        logger.info("🛡️ 生产模式：使用 waitress 启动（threads=%s）", threads)
        logger.info("Serving via waitress on %s:%s (threads=%s)", host, port, threads)
        serve(app, host=host, port=port, threads=threads, ident="MarkiNote")
    else:
        logger.info("🧪 开发模式：使用 Flask 内置开发服务器")
        logger.info("Serving via Flask development server (debug=%s)", debug)
        app.run(debug=debug, host=host, port=port, use_reloader=False)


if __name__ == '__main__':
    run()
