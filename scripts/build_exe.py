"""使用 uv + PyInstaller 打包 MarkiNote。

用法：
    uv run python scripts/build_exe.py

说明：
    - 在 Linux/WSL 下生成 Linux 可执行文件。
    - 要生成 Windows .exe，请在 Windows PowerShell/CMD 中运行同一命令。
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def run(cmd: list[str]) -> None:
    print(f"$ {' '.join(cmd)}")
    subprocess.run(cmd, cwd=ROOT, check=True)


def main() -> None:
    for path in (ROOT / "build", ROOT / "dist"):
        if path.exists():
            shutil.rmtree(path)

    run([
        sys.executable,
        "-m",
        "PyInstaller",
        "--clean",
        "--noconfirm",
        "MarkiNote.spec",
    ])

    exe = ROOT / "dist" / ("MarkiNote.exe" if sys.platform.startswith("win") else "MarkiNote")
    print("\n✅ 打包完成")
    print(f"可执行文件: {exe}")
    print("打包后运行时，文档库/AI 对话/备份默认写入系统用户应用数据目录。")
    print("可用 MARKINOTE_DATA_DIR 指定数据目录；可用 MARKINOTE_LOG_DIR 指定日志目录。")


if __name__ == "__main__":
    main()
