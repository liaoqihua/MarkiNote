"""路由模块"""
from .main_routes import main_bp
from .library_routes import library_bp
from .ai_routes import ai_bp
from .pdf_routes import pdf_bp
from .word_routes import word_bp

__all__ = ['main_bp', 'library_bp', 'ai_bp', 'pdf_bp', 'word_bp']

