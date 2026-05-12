"""Flask应用初始化"""
import logging
import time

from flask import Flask, g, request

from app.config import Config
from app.runtime import resource_path

logger = logging.getLogger(__name__)


def create_app():
    """创建并配置Flask应用
    
    Returns:
        Flask: 配置好的Flask应用实例
    """
    app = Flask(
        __name__,
        template_folder=str(resource_path('templates')),
        static_folder=str(resource_path('static')),
    )
    
    # 加载配置
    app.config.from_object(Config)
    
    # 初始化配置
    Config.init_app(app)
    
    # 注册 Flask 请求日志中间件
    @app.before_request
    def _log_request_start():
        g._markinote_request_start = time.monotonic()

    @app.after_request
    def _log_request_end(response):
        elapsed_ms = (time.monotonic() - getattr(g, "_markinote_request_start", time.monotonic())) * 1000
        logger.info(
            "%s %s %s %.0fms",
            request.method,
            request.path,
            response.status_code,
            elapsed_ms,
        )
        return response

    # 注册蓝图
    from app.routes import main_bp, library_bp, ai_bp, pdf_bp
    app.register_blueprint(main_bp)
    app.register_blueprint(library_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(pdf_bp)
    
    return app

