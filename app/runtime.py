"""运行时路径、资源定位与日志配置。

这个模块让 MarkiNote 同时兼容：
1. 源码运行：uv run python main.py
2. PyInstaller 打包后运行：dist/MarkiNote 或 MarkiNote.exe
"""
from __future__ import annotations

import logging
import os
import shutil
import sys
from pathlib import Path

APP_NAME = "MarkiNote"
LOG_DIR_NAME = "logs"
LOG_FILE_NAME = "markinote.log"


class TeeStream:
    """把 print/stdout/stderr 同时写到控制台和日志文件。"""

    def __init__(self, stream, log_file):
        self.stream = stream
        self.log_file = log_file

    def write(self, message):
        self.stream.write(message)
        self.stream.flush()
        self.log_file.write(message)
        self.log_file.flush()

    def flush(self):
        self.stream.flush()
        self.log_file.flush()

    def isatty(self):
        return getattr(self.stream, "isatty", lambda: False)()


_stdout_log_handle = None
_stderr_log_handle = None


def is_frozen() -> bool:
    """是否运行在 PyInstaller 打包后的环境中。"""
    return bool(getattr(sys, "frozen", False))


def project_root() -> Path:
    """源码项目根目录。"""
    return Path(__file__).resolve().parent.parent


def executable_dir() -> Path:
    """可执行文件所在目录；源码运行时返回项目根目录。"""
    if is_frozen():
        return Path(sys.executable).resolve().parent
    return project_root()


def resource_path(relative_path: str | os.PathLike[str]) -> Path:
    """获取只读资源路径。

    PyInstaller onefile 模式下，templates/static/lib 等资源会被解包到 sys._MEIPASS。
    源码运行时则直接从项目根目录读取。
    """
    base = Path(getattr(sys, "_MEIPASS", project_root()))
    return base / relative_path


def get_app_data_dir() -> Path:
    """获取系统推荐的用户级应用数据目录。

    - Windows: %LOCALAPPDATA%\\MarkiNote
    - macOS: ~/Library/Application Support/MarkiNote
    - Linux/WSL: ~/.local/share/MarkiNote 或 $XDG_DATA_HOME/MarkiNote
    """
    if sys.platform.startswith("win"):
        base = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA")
        if base:
            return Path(base) / APP_NAME
        return Path.home() / "AppData" / "Local" / APP_NAME

    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / APP_NAME

    data_home = os.environ.get("XDG_DATA_HOME")
    if data_home:
        return Path(data_home) / APP_NAME
    return Path.home() / ".local" / "share" / APP_NAME


def get_data_dir() -> Path:
    """获取用户可写数据目录。

    优先级：
    1. MARKINOTE_DATA_DIR 环境变量
    2. 打包后：系统推荐的用户级应用数据目录
    3. 源码运行：项目根目录，方便开发时直接查看 lib/
    """
    env_dir = os.environ.get("MARKINOTE_DATA_DIR")
    if env_dir:
        return Path(env_dir).expanduser().resolve()

    if is_frozen():
        return get_app_data_dir()

    return project_root()


def get_log_dir() -> Path:
    """获取日志目录，默认使用各系统推荐的用户级日志位置。

    可通过 MARKINOTE_LOG_DIR 覆盖。
    - Windows: %LOCALAPPDATA%\\MarkiNote\\logs
    - macOS: ~/Library/Logs/MarkiNote
    - Linux/WSL: ~/.local/state/MarkiNote/logs
    """
    env_dir = os.environ.get("MARKINOTE_LOG_DIR")
    if env_dir:
        return Path(env_dir).expanduser().resolve()

    if sys.platform.startswith("win"):
        base = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA")
        if base:
            return Path(base) / APP_NAME / LOG_DIR_NAME
        return Path.home() / "AppData" / "Local" / APP_NAME / LOG_DIR_NAME

    if sys.platform == "darwin":
        return Path.home() / "Library" / "Logs" / APP_NAME

    state_home = os.environ.get("XDG_STATE_HOME")
    if state_home:
        return Path(state_home) / APP_NAME / LOG_DIR_NAME
    return Path.home() / ".local" / "state" / APP_NAME / LOG_DIR_NAME


def ensure_data_dirs() -> dict[str, Path]:
    """创建运行所需的可写目录，并在首次运行时初始化文档库。"""
    data_dir = get_data_dir()
    lib_dir = data_dir / "lib"
    conversations_dir = data_dir / ".ai_conversations"
    backups_dir = data_dir / ".ai_backups"
    logs_dir = get_log_dir()

    for path in (data_dir, lib_dir, conversations_dir, backups_dir, logs_dir):
        path.mkdir(parents=True, exist_ok=True)

    # 打包后首次运行时，把内置示例文档复制到外部可写 lib 目录。
    bundled_lib = resource_path("lib")
    if bundled_lib.exists() and not any(lib_dir.iterdir()):
        for item in bundled_lib.iterdir():
            target = lib_dir / item.name
            if item.is_dir():
                shutil.copytree(item, target, dirs_exist_ok=True)
            else:
                shutil.copy2(item, target)

    return {
        "data_dir": data_dir,
        "lib_dir": lib_dir,
        "conversations_dir": conversations_dir,
        "backups_dir": backups_dir,
        "logs_dir": logs_dir,
        "log_file": logs_dir / LOG_FILE_NAME,
    }


def setup_logging() -> Path:
    """配置日志：控制台输出保留，同时写入日志文件。"""
    global _stdout_log_handle, _stderr_log_handle

    paths = ensure_data_dirs()
    log_file = paths["log_file"]

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # 避免重复添加 handler（Flask reloader 或测试导入时可能重复执行）。
    if not any(getattr(handler, "_markinote_file", False) for handler in root_logger.handlers):
        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler.setFormatter(formatter)
        file_handler._markinote_file = True
        root_logger.addHandler(file_handler)

    if not any(getattr(handler, "_markinote_console", False) for handler in root_logger.handlers):
        console_handler = logging.StreamHandler(sys.__stdout__)
        console_handler.setFormatter(formatter)
        console_handler._markinote_console = True
        root_logger.addHandler(console_handler)

    # 捕获 print()/traceback 到同一个日志文件。注意这里用独立文件句柄，避免 logging 递归。
    if not isinstance(sys.stdout, TeeStream):
        _stdout_log_handle = open(log_file, "a", encoding="utf-8", buffering=1)
        sys.stdout = TeeStream(sys.__stdout__, _stdout_log_handle)
    if not isinstance(sys.stderr, TeeStream):
        _stderr_log_handle = open(log_file, "a", encoding="utf-8", buffering=1)
        sys.stderr = TeeStream(sys.__stderr__, _stderr_log_handle)

    return log_file
