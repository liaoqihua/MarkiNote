"""应用配置文件"""

from app.runtime import ensure_data_dirs


class Config:
    """Flask应用配置"""

    _PATHS = ensure_data_dirs()

    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    LIBRARY_FOLDER = str(_PATHS['lib_dir'])
    CONVERSATIONS_DIR = str(_PATHS['conversations_dir'])
    BACKUPS_DIR = str(_PATHS['backups_dir'])
    DATA_DIR = str(_PATHS['data_dir'])
    LOG_FILE = str(_PATHS['log_file'])
    ALLOWED_EXTENSIONS = {'md', 'markdown', 'txt'}
    SEND_FILE_MAX_AGE_DEFAULT = 0  # 开发模式下不缓存静态文件

    @staticmethod
    def init_app(app):
        """初始化应用配置"""
        ensure_data_dirs()

