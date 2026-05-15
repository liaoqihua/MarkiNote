// 全局状态
let currentPath = '';
let selectedFile = null;
let contextMenuTarget = null;
let selectedText = ''; // 存储选中的文本
let isEditingSource = false; // 是否正在编辑源代码
let isEditingPreview = false; // 是否正在实时编辑预览
let previewEditUnsaved = false; // 编辑模式下是否有未保存的改动
let _editorPosition = 'left'; // 编辑器位置：'left' | 'right'
let _sidebarWasCollapsed = false; // 进入编辑前侧边栏是否已收起
let _syncScrolling = false; // 是否正在同步滚动（防止循环触发）
let _editDebounceTimer = null;
let allFiles = []; // 存储所有文件用于搜索
let hasUnsavedChanges = false; // 是否有未保存的改动
let selectedExportFiles = new Set(); // 多文档 PDF 导出选中的文件
let _lastDirItemsHash = ''; // 目录内容指纹，用于静默刷新去重

// DOM元素
const fileList = document.getElementById('fileList');
const previewContent = document.getElementById('previewContent');
const previewTitle = document.getElementById('previewTitle');
const currentFilePath = document.getElementById('currentFilePath');
const breadcrumb = document.getElementById('breadcrumb');
const uploadBtn = document.getElementById('uploadBtn');
const newBtn = document.getElementById('newBtn');
const searchBtn = document.getElementById('searchBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const fileInput = document.getElementById('fileInput');
const viewSourceBtn = document.getElementById('viewSourceBtn');
const exportCurrentPdfBtn = document.getElementById('exportCurrentPdfBtn');
const exportSelectedPdfBtn = document.getElementById('exportSelectedPdfBtn');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const contextMenu = document.getElementById('contextMenu');
const previewContextMenu = document.getElementById('previewContextMenu');
const newSelectModal = document.getElementById('newSelectModal');
const newFileModal = document.getElementById('newFileModal');
const newFolderModal = document.getElementById('newFolderModal');
const uploadModal = document.getElementById('uploadModal');
const sourceModal = document.getElementById('sourceModal');
const moveModal = document.getElementById('moveModal');
const renameModal = document.getElementById('renameModal');
const searchBar = document.getElementById('searchBar');
const searchInput = document.getElementById('searchInput');
const previewToc = document.getElementById('previewToc');
const previewTocList = document.getElementById('previewTocList');
const tocToggleBtn = document.getElementById('tocToggleBtn');
const tocCloseBtn = document.getElementById('tocCloseBtn');
const previewPanel = document.querySelector('.preview-panel');
const toggleAllSelectBtn = document.getElementById('toggleAllSelectBtn');
const toggleEditBtn = document.getElementById('toggleEditBtn');
const previewEditorPane = document.getElementById('previewEditorPane');
const editorTextarea = document.getElementById('editorTextarea');
const editorSaveBtn = document.getElementById('editorSaveBtn');
const editorCancelBtn = document.getElementById('editorCancelBtn');
const editorSwapBtn = document.getElementById('editorSwapBtn');
const saveIndicator = document.getElementById('saveIndicator');
let _saveIndicatorTimer = null;
const renderIndicator = document.getElementById('renderIndicator');

// 存储当前文件的原始markdown内容
let currentMarkdownSource = '';

// ===== 通用复制函数（带兼容性处理） =====
async function copyToClipboard(text) {
    // 方法1: 尝试使用现代 Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.warn('Clipboard API 失败，尝试备用方法:', err);
        }
    }
    
    // 方法2: 使用传统的 execCommand 方法（兼容更多浏览器）
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
            return true;
        } else {
            throw new Error('execCommand 复制失败');
        }
    } catch (err) {
        console.error('所有复制方法都失败了:', err);
        return false;
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    loadLibrary();
    setupEventListeners();
    initializeMermaid();
    loadSidebarState();
    startFileWatcher();
});

// 设置事件监听
function setupEventListeners() {
    uploadBtn.addEventListener('click', openUploadModal);
    newBtn.addEventListener('click', openNewSelectModal);
    searchBtn.addEventListener('click', toggleSearch);
    settingsBtn.addEventListener('click', openSettingsModal);
    fileInput.addEventListener('change', handleFileUpload);
    viewSourceBtn.addEventListener('click', openSourceModal);
    toggleEditBtn.addEventListener('click', toggleEditMode);
    editorSaveBtn.addEventListener('click', saveEditAndPreview);
    editorCancelBtn.addEventListener('click', cancelEditMode);
    editorSwapBtn.addEventListener('click', toggleEditorPosition);
    editorTextarea.addEventListener('input', onEditorInput);
    editorTextarea.addEventListener('keydown', onEditorTextareaKeydown);
    editorTextarea.addEventListener('paste', onEditorPasteImage);
    exportCurrentPdfBtn.addEventListener('click', exportCurrentFileToPdf);
    exportSelectedPdfBtn.addEventListener('click', exportSelectedFilesToPdf);
    if (deleteSelectedBtn) deleteSelectedBtn.addEventListener('click', deleteSelectedItems);
    if (toggleAllSelectBtn) toggleAllSelectBtn.addEventListener('click', toggleAllFileSelection);
    searchInput.addEventListener('input', handleSearch);
    
    // 点击其他地方关闭右键菜单
    document.addEventListener('click', () => {
        contextMenu.classList.remove('show');
        previewContextMenu.classList.remove('show');
    });
    
    // 点击其他地方关闭模态框
    window.addEventListener('click', (e) => {
        if (e.target === newSelectModal) {
            closeNewSelectModal();
        }
        if (e.target === newFileModal) {
            closeNewFileModal();
        }
        if (e.target === newFolderModal) {
            closeNewFolderModal();
        }
        if (e.target === uploadModal) {
            closeUploadModal();
        }
        if (e.target === sourceModal) {
            closeSourceModal();
        }
        if (e.target === moveModal) {
            closeMoveModal();
        }
        if (e.target === renameModal) {
            closeRenameModal();
        }
        if (e.target === settingsModal) {
            closeSettingsModal();
        }
    });
    
    // 回车键创建文件
    document.getElementById('fileNameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            createFile();
        }
    });
    
    // 回车键创建文件夹
    document.getElementById('folderNameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            createFolder();
        }
    });
    
    // 回车键重命名
    document.getElementById('renameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            confirmRename();
        }
    });
    
    // 监听预览内容的右键菜单（选中文字）
    previewContent.addEventListener('contextmenu', showPreviewContextMenu);

    // 目录栏：切换显示/关闭，监听滚动高亮
    if (tocToggleBtn) tocToggleBtn.addEventListener('click', toggleToc);
    if (tocCloseBtn) tocCloseBtn.addEventListener('click', () => setTocVisible(false));
    if (previewContent) previewContent.addEventListener('scroll', onPreviewScroll, { passive: true });
    // 目录栏层级切换按钮（H1/H2/H3/其它）
    document.querySelectorAll('.toc-level-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleTocLevel(btn.dataset.level));
    });
    loadTocLevelFilters();
    // 默认折叠，选中文件后才显示
    loadTocState();

    // 加载保存的主题设置
    loadTheme();

    // ===== 拖拽与多选：在文件列表上使用事件委托 =====
    if (fileList) {
        // 统一鼠标状态机（滑动多选 + 自定义拖拽）
        fileList.addEventListener('mousedown', onFileListMouseDown);
        document.addEventListener('mousemove', onFileListMouseMove);
        document.addEventListener('mouseup', onFileListMouseUp);

        // 悬浮操作提示 tooltip
        fileList.addEventListener('mouseover', onFileListMouseOver);
        fileList.addEventListener('mousemove', onFileListMouseMoveTooltip);
        fileList.addEventListener('mouseout', onFileListMouseOut);
    }
}


// 打开上传选择模态框
function openUploadModal() {
    uploadModal.classList.add('show');
}

// 关闭上传选择模态框
function closeUploadModal() {
    uploadModal.classList.remove('show');
}

// 选择上传类型
function selectUploadType(type) {
    closeUploadModal();
    
    if (type === 'file') {
        // 上传文件
        fileInput.removeAttribute('webkitdirectory');
        fileInput.removeAttribute('directory');
        fileInput.setAttribute('accept', '.md,.markdown,.txt');
    } else if (type === 'folder') {
        // 上传文件夹
        fileInput.setAttribute('webkitdirectory', '');
        fileInput.setAttribute('directory', '');
        fileInput.removeAttribute('accept');
    }
    
    fileInput.click();
}

// 加载Library（优化版，添加性能监控）
// silent=true 时不显示"加载中"提示，用于后台定时刷新
async function loadLibrary(path = '', silent = false) {
    currentPath = path;
    if (!silent) {
        fileList.innerHTML = '<div class="loading">' + t('loading') + '</div>';
    }
    
    const startTime = performance.now();
    
    try {
        const fetchStart = performance.now();
        const response = await fetch(`/api/library/list?path=${encodeURIComponent(path)}`);
        const fetchTime = performance.now() - fetchStart;
        
        const parseStart = performance.now();
        const data = await response.json();
        const parseTime = performance.now() - parseStart;
        
        if (data.success) {
            // 静默模式下，如果目录内容没变则跳过 DOM 重建
            const itemsHash = JSON.stringify(data.items.map(i => i.path + '|' + i.name + '|' + (i.size || '')));
            if (silent && itemsHash === _lastDirItemsHash) {
                return;
            }
            _lastDirItemsHash = itemsHash;

            const renderStart = performance.now();
            displayFiles(data.items);
            const renderTime = performance.now() - renderStart;
            
            updateBreadcrumb(path);
            
            const totalTime = performance.now() - startTime;
            if (!silent) {
                console.log(`📊 加载性能: 总计${totalTime.toFixed(0)}ms | 网络${fetchTime.toFixed(0)}ms | 解析${parseTime.toFixed(0)}ms | 渲染${renderTime.toFixed(0)}ms | 文件数${data.items.length}`);
            }
        } else if (!silent) {
            showError(t('load_list_fail'));
        }
    } catch (error) {
        if (!silent) {
            showError(t('load_fail') + error.message);
            console.error('❌ 加载错误:', error);
        }
    }
}

// 显示文件列表（优化版，使用DocumentFragment减少重绘）
function displayFiles(items) {
    if (items.length === 0) {
        fileList.innerHTML = '<div class="empty-state">' + t('folder_empty') + '<br><small style="color: var(--text-secondary); margin-top: 8px;">' + t('folder_empty_hint') + '</small></div>';
        return;
    }
    
    // 使用 DocumentFragment 批量添加DOM，减少重绘次数
    const fragment = document.createDocumentFragment();
    
    items.forEach(item => {
        const icon = item.type === 'folder' 
            ? '<svg width="24" height="24" viewBox="0 0 16 16" fill="#3b82f6"><path d="M.54 3.87L.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.826a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31z"/></svg>'
            : '<svg width="24" height="24" viewBox="0 0 16 16" fill="#64748b"><path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/></svg>';
        
        const size = item.size ? formatFileSize(item.size) : '';
        const modified = item.modified ? formatDate(item.modified) : '';
        
        const div = document.createElement('div');
        div.className = `file-item ${item.type}`;
        div.dataset.path = item.path;
        div.dataset.type = item.type;
        div.dataset.itemName = item.name;
        // 不使用 HTML5 原生拖拽，改由统一鼠标状态机处理（见 onFileListMouseDown/Move/Up）
        div.draggable = false;
        div.oncontextmenu = (e) => showContextMenu(e, item.path, item.type);
        
        const isSelected = selectedExportFiles.has(item.path);

        div.innerHTML = `
            <label class="file-select" title="${t('select_all')}" onclick="event.stopPropagation()"><input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleExportSelection(event, '${item.path}')"></label>
            <div class="file-icon">${icon}</div>
            <div class="file-info">
                <div class="file-name">${item.name}</div>
                <div class="file-meta">${size} ${size && modified ? '•' : ''} ${modified}</div>
            </div>
            <button class="file-menu-btn" onclick="showContextMenuFromButton(event, '${item.path}', '${item.type}')" title="${t('more_actions')}">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
                </svg>
            </button>
        `;
        
        // 保持当前选中文件的高亮状态
        if (selectedFile && item.path === selectedFile) {
            div.classList.add('selected');
        }

        fragment.appendChild(div);
    });
    
    // 一次性添加所有元素，只触发一次重绘
    fileList.innerHTML = '';
    fileList.appendChild(fragment);
    updateToggleAllSelectBtn();
}

// 更新面包屑导航
function updateBreadcrumb(path) {
    const parts = path ? path.split('/').filter(p => p) : [];
    let html = `<span class="breadcrumb-item" data-path="" onclick="loadLibrary('')">${t('root_dir')}</span>`;
    
    let accumulated = '';
    parts.forEach((part, index) => {
        accumulated += (accumulated ? '/' : '') + part;
        const isLast = index === parts.length - 1;
        html += `<span class="breadcrumb-item ${isLast ? 'active' : ''}" data-path="${accumulated}"
                      onclick="loadLibrary('${accumulated}')">${part}</span>`;
    });
    
    breadcrumb.innerHTML = html;
}

// 处理文件/文件夹点击
function handleFileClick(path, type) {
    if (type === 'folder') {
        loadLibrary(path);
    } else {
        selectFile(path);
        previewFile(path);
    }
}

// 选中文件
function selectFile(path) {
    // 如果正在编辑模式且选择了不同的文件，先退出编辑
    if (isEditingPreview && selectedFile !== path) {
        forceExitEditMode();
    }

    selectedFile = path;
    
    // 更新UI选中状态
    document.querySelectorAll('.file-item').forEach(item => {
        item.classList.remove('selected');
        if (item.dataset.path === path) {
            item.classList.add('selected');
        }
    });
    
    // 启用查看源代码和当前文档 PDF 导出按钮
    viewSourceBtn.disabled = false;
    toggleEditBtn.disabled = false;
    exportCurrentPdfBtn.disabled = false;
    if (tocToggleBtn) tocToggleBtn.disabled = false;

    // 同步 AI 上下文
    if (typeof window.setAIContextFile === 'function') {
        window.setAIContextFile(path);
    }
}

// 预览文件
// silent=true 时不显示"加载中"提示，用于后台定时刷新
async function previewFile(path, silent = false, restoreScroll = false) {
    // 编辑模式下不接受静默刷新，避免覆盖用户正在编辑的内容
    if (silent && isEditingPreview) {
        return;
    }

    // 在设置 loading 之前保存滚动位置，避免被 loading div 覆盖为 0
    const savedScrollTop = previewContent.scrollTop;

    if (!silent) {
        previewContent.innerHTML = '<div class="loading">' + t('loading') + '</div>';
        previewTitle.textContent = t('loading');
    }
    currentFilePath.textContent = path;
    
    try {
        const response = await fetch('/api/preview', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ path })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 静默模式下，如果内容没变则不刷新 DOM，避免打断用户阅读
            if (silent && currentMarkdownSource === (data.raw_markdown || '')) {
                return;
            }

            previewTitle.textContent = data.filename;
            currentMarkdownSource = data.raw_markdown || '';
            previewContent.innerHTML = `<div class="markdown-body">${data.html}</div>`;

            // 修复图片路径：将相对路径转换为 API 路由
            const mdBody = previewContent.querySelector('.markdown-body');
            if (mdBody) fixImagePaths(mdBody);
            
            // 添加代码块复制按钮
            addCodeCopyButtons();
            
            // 添加数学公式复制按钮
            addMathCopyButtons();
            
            // 渲染Mermaid图表
            renderMermaidDiagrams();
            
            // 触发MathJax渲染
            renderMathJax();

            // 渲染完成后构建目录
            buildToc();

            // 静默刷新或 restoreScroll 模式下恢复滚动位置
            if (silent || restoreScroll) {
                previewContent.scrollTop = savedScrollTop;
            }
        } else if (!silent) {
            showError(data.error || t('preview_fail'));
        }
    } catch (error) {
        if (!silent) {
            showError(t('preview_fail') + ': ' + error.message);
        }
    }
}

function toggleExportSelection(event, path) {
    if (event) event.stopPropagation();
    if (event.target.checked) {
        selectedExportFiles.add(path);
    } else {
        selectedExportFiles.delete(path);
    }
    updateExportSelectionState();
}

function updateExportSelectionState() {
    // 只统计文件，文件夹不参与导出计数
    const fileCount = _countSelectedFiles();
    exportSelectedPdfBtn.disabled = fileCount === 0;
    exportSelectedPdfBtn.title = fileCount > 0
        ? `导出选中的 ${fileCount} 个文档为 PDF`
        : '导出选中文档为 PDF';
    // 更新删除选中按钮状态（文件+文件夹都算）
    const itemCount = selectedExportFiles.size;
    if (deleteSelectedBtn) {
        deleteSelectedBtn.disabled = itemCount === 0;
        deleteSelectedBtn.title = itemCount > 0
            ? (typeof t === 'function' ? t('delete_selected_title', { count: itemCount }) : `删除选中文档（${itemCount} 个）`)
            : (typeof t === 'function' ? t('delete_selected') : '删除选中文档');
    }
    updateToggleAllSelectBtn();
}

// 统计当前勾选中的文件数量
function _countSelectedFiles() {
    let count = 0;
    selectedExportFiles.forEach(path => {
        const el = fileList.querySelector(`.file-item[data-path="${_escapeSelector(path)}"]`);
        if (el && el.dataset.type === 'file') count++;
    });
    return count;
}

// 获取当前文件列表中所有可勾选的节点（文件和文件夹）
function _getVisibleFileItems() {
    return Array.from(fileList.querySelectorAll('.file-item[data-path]'));
}

// 全选/全不选切换
function toggleAllFileSelection() {
    const items = _getVisibleFileItems();
    if (!items.length) return;
    const allSelected = items.every(it => selectedExportFiles.has(it.dataset.path));
    const target = !allSelected;
    items.forEach(it => {
        const path = it.dataset.path;
        if (!path) return;
        if (target) selectedExportFiles.add(path);
        else selectedExportFiles.delete(path);
        const cb = it.querySelector('input[type="checkbox"]');
        if (cb) cb.checked = target;
    });
    updateExportSelectionState();
}

// 根据当前状态刷新"全选/全不选"按钮的提示与图标
function updateToggleAllSelectBtn() {
    if (!toggleAllSelectBtn) return;
    const items = _getVisibleFileItems();
    toggleAllSelectBtn.disabled = items.length === 0;
    const allSelected = items.length > 0 && items.every(it => selectedExportFiles.has(it.dataset.path));
    toggleAllSelectBtn.classList.toggle('all-selected', allSelected);
    const title = (typeof t === 'function')
        ? (allSelected ? t('deselect_all') : t('select_all'))
        : (allSelected ? '全不选' : '全选当前目录文件');
    toggleAllSelectBtn.title = title;
}

function filenameFromDisposition(disposition, fallback) {
    if (!disposition) return fallback;
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match) {
        try { return decodeURIComponent(utf8Match[1]); } catch (e) { return fallback; }
    }
    const match = disposition.match(/filename="?([^";]+)"?/i);
    return match ? match[1] : fallback;
}

async function downloadPdfResponse(response, fallbackName) {
    const contentType = response.headers.get('Content-Type') || '';
    if (!response.ok) {
        if (contentType.includes('application/json')) {
            const data = await response.json();
            throw new Error(data.error || 'PDF 导出失败');
        }
        throw new Error('PDF 导出失败');
    }

    const blob = await response.blob();
    const filename = filenameFromDisposition(response.headers.get('Content-Disposition'), fallbackName);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
}

async function exportFileToPdf(path) {
    try {
        showSuccess('正在生成 PDF...');
        const response = await fetch('/api/export/pdf', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ path })
        });
        await downloadPdfResponse(response, `${path.split('/').pop().replace(/\.[^.]+$/, '') || 'MarkiNote'}.pdf`);
    } catch (error) {
        showError(error.message);
    }
}

async function exportCurrentFileToPdf() {
    if (!selectedFile) {
        showError('请先选择一个文档');
        return;
    }
    await exportFileToPdf(selectedFile);
}

async function exportSelectedFilesToPdf() {
    // 过滤掉文件夹，只导出文件
    const allPaths = Array.from(selectedExportFiles);
    const paths = allPaths.filter(p => {
        const el = fileList.querySelector(`.file-item[data-path="${_escapeSelector(p)}"]`);
        return el && el.dataset.type === 'file';
    });
    if (paths.length === 0) {
        showError('请先勾选要导出的文档');
        return;
    }

    try {
        const mergeToOne = paths.length === 1 || confirm(
            `批量导出 ${paths.length} 个文档：\n\n点击“确定”合并导出为一个 PDF。\n点击“取消”按各个文件分别导出，并打包为 ZIP。`
        );
        showSuccess(mergeToOne
            ? `正在合并导出 ${paths.length} 个文档...`
            : `正在分别导出 ${paths.length} 个文档...`);
        const response = await fetch(mergeToOne ? '/api/export/pdf/batch' : '/api/export/pdf/batch/separate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ paths })
        });
        await downloadPdfResponse(response, mergeToOne ? 'MarkiNote-Export.pdf' : 'MarkiNote-PDFs.zip');
    } catch (error) {
        showError(error.message);
    }
}

// 文件上传（支持文件夹）
async function handleFileUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    // 过滤只保留支持的文件类型
    const allowedExtensions = ['.md', '.markdown', '.txt'];
    const validFiles = files.filter(file => {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        return allowedExtensions.includes(ext);
    });
    
    if (validFiles.length === 0) {
        showError(t('no_supported_files'));
        fileInput.value = '';
        return;
    }

    let successCount = 0;
    let failCount = 0;
    
    for (const file of validFiles) {
        // 获取相对路径（如果是文件夹上传）
        let relativePath = file.webkitRelativePath || file.name;
        
        // 如果是文件夹上传，提取文件夹结构
        let targetPath = currentPath;
        if (file.webkitRelativePath) {
            const pathParts = file.webkitRelativePath.split('/');
            if (pathParts.length > 1) {
                // 移除文件名，保留文件夹路径
                const folderPath = pathParts.slice(0, -1).join('/');
                targetPath = currentPath ? `${currentPath}/${folderPath}` : folderPath;
            }
        }
        
    const formData = new FormData();
    formData.append('file', file);
        formData.append('path', targetPath);

    try {
            const response = await fetch('/api/library/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

            if (data.success) {
                successCount++;
        } else {
                failCount++;
                console.error('上传失败:', file.name, data.error);
        }
    } catch (error) {
            failCount++;
            console.error('上传失败:', file.name, error.message);
        }
    }
    
    // 显示上传结果
    if (successCount > 0) {
        showSuccess(t('upload_success', {count: successCount}) + (failCount > 0 ? t('upload_fail_count', {count: failCount}) : ''));
    } else {
        showError(t('upload_fail'));
    }
    
    // 清空文件输入
    fileInput.value = '';
    
    // 刷新文件列表
    setTimeout(() => loadLibrary(currentPath), 500);
}

// 打开新建文件夹模态框
function openNewFolderModal() {
    newFolderModal.classList.add('show');
    document.getElementById('folderNameInput').value = '';
    document.getElementById('folderNameInput').focus();
}

// 关闭新建文件夹模态框
function closeNewFolderModal() {
    newFolderModal.classList.remove('show');
}

// 创建文件夹
async function createFolder() {
    const name = document.getElementById('folderNameInput').value.trim();
    
    if (!name) {
        showError(t('enter_folder_name'));
        return;
    }
    
    try {
        const response = await fetch('/api/library/create-folder', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                path: currentPath
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess(t('folder_create_success'));
            closeNewFolderModal();
            loadLibrary(currentPath);
        } else {
            showError(data.error || t('create_fail'));
        }
    } catch (error) {
        showError(t('create_fail') + ': ' + error.message);
    }
}

// 显示右键菜单
function showContextMenu(event, path, type) {
    event.preventDefault();
    event.stopPropagation();
    
    contextMenuTarget = { path, type };
    
    // 定位菜单
    contextMenu.style.left = event.pageX + 'px';
    contextMenu.style.top = event.pageY + 'px';
    contextMenu.classList.add('show');
}

// 从"..."按钮显示右键菜单
function showContextMenuFromButton(event, path, type) {
    event.preventDefault();
    event.stopPropagation();
    
    contextMenuTarget = { path, type };
    
    // 获取按钮位置
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    
    // 定位菜单到按钮下方
    contextMenu.style.left = (rect.left - 100) + 'px'; // 向左偏移一些
    contextMenu.style.top = (rect.bottom + 5) + 'px';
    contextMenu.classList.add('show');
}

// 右键菜单操作
async function contextMenuAction(action) {
    if (!contextMenuTarget) return;
    
    const { path, type } = contextMenuTarget;
    
    switch (action) {
        case 'rename':
            // 打开重命名模态框
            openRenameModal(path, type);
            break;
            
        case 'move':
            // 打开移动文件模态框
            openMoveModal(path);
            break;

        case 'exportPdf':
            if (type === 'file') {
                await exportFileToPdf(path);
            } else {
                showError('只能导出文件，不能直接导出文件夹');
            }
            break;
            
        case 'delete':
            if (confirm(t('delete_confirm', {name: path.split('/').pop()}))) {
                await deleteItem(path, type);
            }
            break;
    }
    
    contextMenu.classList.remove('show');
}

// 打开移动文件模态框
async function openMoveModal(sourcePath) {
    const itemName = sourcePath.split('/').pop();
    document.getElementById('moveItemName').textContent = itemName;
    
    // 加载文件夹列表
    const folderList = document.getElementById('folderList');
    folderList.innerHTML = '<div class="loading">' + t('loading') + '</div>';
    
    try {
        const response = await fetch('/api/library/folders');
        const data = await response.json();
        
        if (data.success) {
            displayFolderList(data.folders, sourcePath);
        } else {
            folderList.innerHTML = '<div class="empty-state">' + t('load_folder_fail') + '</div>';
        }
    } catch (error) {
        folderList.innerHTML = '<div class="empty-state">' + t('load_fail') + error.message + '</div>';
    }
    
    moveModal.classList.add('show');
}

// 显示文件夹列表
function displayFolderList(folders, sourcePath) {
    const folderList = document.getElementById('folderList');
    
    if (folders.length === 0) {
        folderList.innerHTML = '<div class="empty-state">' + t('no_move_target') + '</div>';
        return;
    }
    
    // 获取源文件的父文件夹路径
    const sourceParentPath = sourcePath.includes('/') 
        ? sourcePath.substring(0, sourcePath.lastIndexOf('/')) 
        : '';
    
    // 过滤掉无效的文件夹：
    // 1. 源路径本身（不能移动到自己）
    // 2. 源路径的子文件夹（避免循环移动）
    // 3. 源文件的父文件夹（已经在那里了，移动无意义）
    const validFolders = folders.filter(folder => {
        // 过滤源路径本身
        if (folder.path === sourcePath) return false;
        // 过滤源路径的子文件夹
        if (folder.path.startsWith(sourcePath + '/')) return false;
        // 过滤源文件的父文件夹（它已经在那里了）
        if (folder.path === sourceParentPath) return false;
        return true;
    });
    
    if (validFolders.length === 0) {
        folderList.innerHTML = '<div class="empty-state">' + t('no_move_target') + '</div>';
        return;
    }
    
    folderList.innerHTML = validFolders.map(folder => {
        // 根目录特殊处理
        const isRoot = folder.path === '';
        
        // 计算缩进和层级指示器
        const level = folder.level;
        const indentPixels = (level - (isRoot ? 0 : 1)) * 24; // 每层缩进24px
        
        // 层级指示器（使用竖线和横线）
        let levelIndicator = '';
        if (!isRoot && level > 0) {
            // 为子文件夹添加树形连接线
            levelIndicator = '<span class="folder-tree-line"></span>';
        }
        
        // 图标
        const icon = isRoot
            ? '<svg width="18" height="18" viewBox="0 0 16 16" fill="#f59e0b"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z"/></svg>'
            : '<svg width="18" height="18" viewBox="0 0 16 16" fill="#3b82f6"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z"/></svg>';
        
        return `
            <div class="folder-item folder-level-${level}" onclick="selectTargetFolder('${folder.path}', '${folder.name}')" style="padding-left: ${indentPixels + 16}px;">
                ${levelIndicator}
                ${icon}
                <span class="folder-name">${folder.name}</span>
            </div>
        `;
    }).join('');
}

// 选择目标文件夹并移动
async function selectTargetFolder(targetPath, targetName) {
    if (!contextMenuTarget) return;
    
    const sourcePath = contextMenuTarget.path;
    
    // 确认移动
    const itemName = sourcePath.split('/').pop();
    if (confirm(t('move_confirm', {item: itemName, target: targetName}))) {
        closeMoveModal();
        await moveItem(sourcePath, targetPath);
    }
}

// 关闭移动文件模态框
function closeMoveModal() {
    moveModal.classList.remove('show');
}

// 移动文件
async function moveItem(source, target) {
    try {
        const response = await fetch('/api/library/move', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                source: source,
                target: target
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess(t('move_success'));
            loadLibrary(currentPath);
    } else {
            showError(data.error || t('move_fail'));
        }
    } catch (error) {
        showError(t('move_fail') + ': ' + error.message);
    }
}

// 删除文件/文件夹
async function deleteItem(path, type = 'file') {
    try {
        const response = await fetch('/api/library/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ path })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess(t('delete_success'));

            // 删除文件/文件夹后，清理批量 PDF 导出的勾选状态，避免保留已不存在的路径
            if (window.MarkiNoteSelectionState) {
                selectedExportFiles = new Set(
                    window.MarkiNoteSelectionState.pruneSelectionAfterDelete(
                        selectedExportFiles,
                        path,
                        type
                    )
                );
            } else {
                selectedExportFiles.delete(path);
            }
            updateExportSelectionState();
            
            // 如果删除的是当前选中的文件，清空预览
            if (selectedFile === path) {
                selectedFile = null;
                currentMarkdownSource = '';
                previewContent.innerHTML = `
                    <div class="welcome-message">
                        <h3>${t('file_deleted')}</h3>
                        <p>${t('select_other_file')}</p>
                    </div>
                `;
                previewTitle.textContent = t('select_file_preview');
                currentFilePath.textContent = '';
                viewSourceBtn.disabled = true;
                toggleEditBtn.disabled = true;
                exportCurrentPdfBtn.disabled = true;
            }
            
            loadLibrary(currentPath);
        } else {
            showError(data.error || t('delete_fail'));
        }
    } catch (error) {
        showError(t('delete_fail') + ': ' + error.message);
    }
}

// 批量删除选中的文件/文件夹
async function deleteSelectedItems() {
    if (selectedExportFiles.size === 0) return;

    const paths = Array.from(selectedExportFiles);
    const count = paths.length;

    const confirmMsg = typeof t === 'function'
        ? t('batch_delete_confirm', { count })
        : `确定要删除选中的 ${count} 项吗？此操作不可恢复。`;

    if (!confirm(confirmMsg)) return;

    try {
        const response = await fetch('/api/library/delete/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paths })
        });

        const data = await response.json();

        if (data.deleted > 0) {
            // 清理勾选状态
            if (window.MarkiNoteSelectionState) {
                for (const p of paths) {
                    const itemType = _detectItemType(p);
                    selectedExportFiles = new Set(
                        window.MarkiNoteSelectionState.pruneSelectionAfterDelete(
                            selectedExportFiles, p, itemType
                        )
                    );
                }
            } else {
                selectedExportFiles.clear();
            }
            updateExportSelectionState();

            // 如果删除的包含当前选中的文件，清空预览
            const selectedDeleted = selectedFile && (
                paths.includes(selectedFile)
                || paths.some(p => {
                    const el = fileList.querySelector(`.file-item[data-path="${_escapeSelector(p)}"]`);
                    return el && el.dataset.type === 'folder' && selectedFile.startsWith(p + '/');
                })
            );
            if (selectedDeleted) {
                selectedFile = null;
                currentMarkdownSource = '';
                previewContent.innerHTML = `
                    <div class="welcome-message">
                        <h3>${t('file_deleted')}</h3>
                        <p>${t('select_other_file')}</p>
                    </div>
                `;
                previewTitle.textContent = t('select_file_preview');
                currentFilePath.textContent = '';
                viewSourceBtn.disabled = true;
                toggleEditBtn.disabled = true;
                exportCurrentPdfBtn.disabled = true;
            }

            showSuccess(typeof t === 'function'
                ? t('batch_delete_success', { count: data.deleted })
                : `成功删除 ${data.deleted} 项`);
            loadLibrary(currentPath);
        }

        if (data.failed > 0) {
            const errDetails = data.errors.map(e => `${e.path}: ${e.error}`).join('\n');
            showError((typeof t === 'function' ? t('batch_delete_fail') : '批量删除失败')
                + `：${data.failed} 项失败\n${errDetails}`);
        }
    } catch (error) {
        showError((typeof t === 'function' ? t('batch_delete_fail') : '批量删除失败')
            + ': ' + error.message);
    }
}

// 通过路径判断文件/文件夹类型
function _detectItemType(path) {
    const el = fileList.querySelector(`.file-item[data-path="${_escapeSelector(path)}"]`);
    if (el) {
        return el.dataset.type || 'file';
    }
    return 'file';
}

// ===== 重命名功能 =====

// 打开重命名模态框
function openRenameModal(path, type) {
    const fileName = path.split('/').pop();
    document.getElementById('renameItemOldName').textContent = fileName;
    
    // 如果是文件，只显示文件名（不含扩展名）
    if (type === 'file') {
        const lastDotIndex = fileName.lastIndexOf('.');
        if (lastDotIndex > 0) {
            const nameWithoutExt = fileName.substring(0, lastDotIndex);
            document.getElementById('renameInput').value = nameWithoutExt;
        } else {
            document.getElementById('renameInput').value = fileName;
        }
    } else {
        document.getElementById('renameInput').value = fileName;
    }
    
    document.getElementById('renameError').style.display = 'none';
    
    // 存储当前路径和类型以便后续使用
    contextMenuTarget = { path, type };
    
    renameModal.classList.add('show');
    // 聚焦输入框并选中全部文本
    const input = document.getElementById('renameInput');
    input.focus();
    input.select();
}

// 关闭重命名模态框
function closeRenameModal() {
    renameModal.classList.remove('show');
}

// 确认重命名
async function confirmRename() {
    if (!contextMenuTarget) return;
    
    const newNameInput = document.getElementById('renameInput').value.trim();
    const errorElement = document.getElementById('renameError');
    const { path: oldPath, type } = contextMenuTarget;
    const oldName = oldPath.split('/').pop();
    
    // 验证新名称
    if (!newNameInput) {
        errorElement.textContent = t('name_empty');
        errorElement.style.display = 'block';
        return;
    }
    
    // 检查是否包含非法字符
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(newNameInput)) {
        errorElement.textContent = t('invalid_chars');
        errorElement.style.display = 'block';
        return;
    }
    
    // 构造完整的新名称
    let newName;
    if (type === 'file') {
        // 文件：保持原有扩展名
        const lastDotIndex = oldName.lastIndexOf('.');
        if (lastDotIndex > 0) {
            const extension = oldName.substring(lastDotIndex);
            newName = newNameInput + extension;
        } else {
            newName = newNameInput;
        }
    } else {
        // 文件夹：直接使用新名称
        newName = newNameInput;
    }
    
    // 检查名称是否改变
    if (newName === oldName) {
        errorElement.textContent = t('name_same');
        errorElement.style.display = 'block';
        return;
    }
    
    try {
        const response = await fetch('/api/library/rename', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                old_path: oldPath,
                new_name: newName
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess(t('rename_success'));
            closeRenameModal();
            
            // 如果重命名的是当前选中的文件，更新选中状态
            if (selectedFile === oldPath) {
                selectedFile = data.new_path;
                currentFilePath.textContent = data.new_path;
            }
            
            // 刷新文件列表
            loadLibrary(currentPath);
        } else {
            errorElement.textContent = data.error || t('rename_fail');
            errorElement.style.display = 'block';
        }
    } catch (error) {
        errorElement.textContent = t('rename_fail') + ': ' + error.message;
        errorElement.style.display = 'block';
    }
}

// ===== 预览内容右键菜单功能 =====

// 显示预览内容右键菜单
function showPreviewContextMenu(event) {
    // 获取选中的文本
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    // 只有选中了文本才显示菜单
    if (!text) {
        return;
    }
    
    event.preventDefault();
    event.stopPropagation();
    
    selectedText = text;
    
    // 检测选中的文本是否包含换行符
    const hasNewline = text.includes('\n') || text.includes('\r');
    
    // 获取"在源代码中显示"菜单项
    const findInSourceMenuItem = document.getElementById('findInSourceMenuItem');
    
    // 如果包含换行，隐藏该选项；否则显示
    if (findInSourceMenuItem) {
        findInSourceMenuItem.style.display = hasNewline ? 'none' : 'flex';
    }
    
    // 定位菜单
    previewContextMenu.style.left = event.pageX + 'px';
    previewContextMenu.style.top = event.pageY + 'px';
    previewContextMenu.classList.add('show');
    
    // 隐藏Library右键菜单
    contextMenu.classList.remove('show');
}

// 预览右键菜单操作
async function previewContextMenuAction(action) {
    if (!selectedText) return;
    
    switch (action) {
        case 'copy':
            // 复制选中的文本（无提示）
            const success = await copyToClipboard(selectedText);
            if (!success) {
                showError(t('copy_fail'));
            }
            break;
            
        case 'bing':
            // 用必应搜索
            const searchUrl = `https://cn.bing.com/search?q=${encodeURIComponent(selectedText)}`;
            window.open(searchUrl, '_blank');
            break;
            
        case 'findInSource':
            // 在源代码中找到
            if (!currentMarkdownSource) {
                showError(t('no_source'));
                return;
            }
            
            // 打开源代码模态框
            const codeElement = document.querySelector('#sourceContent code');
            codeElement.textContent = currentMarkdownSource;
            sourceModal.classList.add('show');
            
            // 在源代码中高亮并滚动到选中的文本
            setTimeout(() => {
                highlightTextInSource(selectedText);
            }, 100);
            break;
    }
    
    previewContextMenu.classList.remove('show');
}

// 在源代码中高亮文本
function highlightTextInSource(searchText) {
    const codeElement = document.querySelector('#sourceContent code');
    if (!codeElement) return;
    
    const sourceText = codeElement.textContent;
    const index = sourceText.indexOf(searchText);
    
    if (index === -1) {
        showError(t('source_not_found'));
        return;
    }
    
    // 使用HTML来高亮文本
    const beforeText = sourceText.substring(0, index);
    const matchText = sourceText.substring(index, index + searchText.length);
    const afterText = sourceText.substring(index + searchText.length);
    
    codeElement.innerHTML = 
        escapeHtml(beforeText) + 
        '<mark style="background-color: #ffeb3b; padding: 2px 4px; border-radius: 3px;">' + 
        escapeHtml(matchText) + 
        '</mark>' + 
        escapeHtml(afterText);
    
    // 滚动到高亮位置
    const markElement = codeElement.querySelector('mark');
    if (markElement) {
        markElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// HTML转义函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== 源代码编辑功能 =====

// 编辑源代码
function editSourceCode() {
    isEditingSource = true;
    hasUnsavedChanges = false; // 重置未保存标志
    const codeElement = document.querySelector('#sourceContent code');
    const editorElement = document.getElementById('sourceEditor');
    
    // 切换显示
    document.getElementById('sourceContent').style.display = 'none';
    editorElement.style.display = 'block';
    editorElement.value = currentMarkdownSource;
    
    // 监听编辑器内容变化
    editorElement.oninput = function() {
        hasUnsavedChanges = (editorElement.value !== currentMarkdownSource);
    };
    
    // 切换按钮
    document.getElementById('sourceViewActions').style.display = 'none';
    document.getElementById('sourceEditActions').style.display = 'flex';
    document.getElementById('sourceModalTitle').textContent = t('edit_source');
    
    // 隐藏关闭按钮
    document.body.classList.add('editing-source');
    
    // 聚焦编辑器
    editorElement.focus();
}

// 取消编辑源代码
function cancelEditSourceCode() {
    // 如果有未保存的改动，弹窗提醒
    if (hasUnsavedChanges) {
        if (!confirm(t('unsaved_exit'))) {
            return; // 用户取消退出
        }
    }
    
    isEditingSource = false;
    hasUnsavedChanges = false;
    
    // 恢复显示
    document.getElementById('sourceContent').style.display = 'block';
    document.getElementById('sourceEditor').style.display = 'none';
    
    // 移除编辑器的事件监听
    document.getElementById('sourceEditor').oninput = null;
    
    // 切换按钮
    document.getElementById('sourceViewActions').style.display = 'flex';
    document.getElementById('sourceEditActions').style.display = 'none';
    document.getElementById('sourceModalTitle').textContent = t('source_code');
    
    // 显示关闭按钮
    document.body.classList.remove('editing-source');
}

// 保存源代码
async function saveSourceCode() {
    if (!selectedFile) {
        showError(t('no_source'));
        return;
    }
    
    const editorElement = document.getElementById('sourceEditor');
    const newContent = editorElement.value;
    
    try {
        const response = await fetch('/api/library/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: selectedFile,
                content: newContent
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess(t('save_success'));
            currentMarkdownSource = newContent;
            hasUnsavedChanges = false; // 重置未保存标志
            
            // 更新代码显示
            const codeElement = document.querySelector('#sourceContent code');
            codeElement.textContent = newContent;
            
            // 退出编辑模式
            isEditingSource = false;
            document.getElementById('sourceContent').style.display = 'block';
            document.getElementById('sourceEditor').style.display = 'none';
            document.getElementById('sourceEditor').oninput = null;
            document.getElementById('sourceViewActions').style.display = 'flex';
            document.getElementById('sourceEditActions').style.display = 'none';
            document.getElementById('sourceModalTitle').textContent = t('source_code');
            document.body.classList.remove('editing-source');
            
            // 刷新预览
            previewFile(selectedFile);
        } else {
            showError(data.error || t('save_fail'));
        }
    } catch (error) {
        showError(t('save_fail') + ': ' + error.message);
    }
}

// 关闭源代码模态框（确保清理编辑状态）
function closeSourceModal() {
    if (isEditingSource) {
        // 如果正在编辑且有未保存的改动，提醒用户
        if (hasUnsavedChanges) {
            if (!confirm(t('unsaved_close'))) {
                return; // 用户取消关闭
            }
        }
        // 强制退出编辑模式（不再检查hasUnsavedChanges，因为已经确认过了）
        isEditingSource = false;
        hasUnsavedChanges = false;
        document.getElementById('sourceContent').style.display = 'block';
        document.getElementById('sourceEditor').style.display = 'none';
        document.getElementById('sourceEditor').oninput = null;
        document.getElementById('sourceViewActions').style.display = 'flex';
        document.getElementById('sourceEditActions').style.display = 'none';
        document.getElementById('sourceModalTitle').textContent = t('source_code');
        document.body.classList.remove('editing-source');
    }
    sourceModal.classList.remove('show');
}

// ===== 实时编辑预览功能 =====

// 切换编辑模式（左右分栏：左侧编辑器 + 右侧实时预览）
function toggleEditMode() {
    if (!selectedFile || !currentMarkdownSource) {
        showError(t('no_source'));
        return;
    }

    if (isEditingPreview) {
        // 退出编辑模式
        exitEditMode();
    } else {
        // 进入编辑模式
        enterEditMode();
    }
}

function enterEditMode() {
    isEditingPreview = true;
    previewEditUnsaved = false;

    // 保存当前预览滚动比例（在任何布局变更之前，因为 edit-preview class 会改变 clientHeight）
    const prevMaxScroll = previewContent.scrollHeight - previewContent.clientHeight;
    const savedPreviewRatio = prevMaxScroll > 0 ? previewContent.scrollTop / prevMaxScroll : 0;

    // 更新按钮状态
    toggleEditBtn.classList.add('active');
    const btnText = toggleEditBtn.querySelector('.btn-text');
    if (btnText) btnText.textContent = t('preview_mode');

    // 隐藏 TOC
    if (previewToc) previewToc.style.display = 'none';

    // 加载并应用编辑器位置设置
    loadEditorPosition();
    applyEditorPosition();

    // 显示编辑器面板
    previewEditorPane.style.display = 'flex';
    previewContent.classList.add('edit-preview');

    // 自动收起侧边栏（不持久化，避免 F5 刷新后仍收起）
    const appContainer = document.querySelector('.app-container');
    _sidebarWasCollapsed = appContainer.classList.contains('sidebar-collapsed');
    setSidebarCollapsed(true, false);

    // 设置编辑器内容并聚焦
    editorTextarea.value = currentMarkdownSource;
    editorTextarea.focus();

    // 初始化 marked 配置
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            breaks: true,
            gfm: true
        });
    }

    // 实时渲染初始内容
    renderLivePreview();

    // 布局稳定后，按比例同步预览和编辑器的滚动位置
    requestAnimationFrame(() => {
        // 恢复预览的滚动位置（edit-preview 布局下 clientHeight 已变化，用比例重新计算）
        const previewMaxScroll = previewContent.scrollHeight - previewContent.clientHeight;
        if (previewMaxScroll > 0) {
            previewContent.scrollTop = savedPreviewRatio * previewMaxScroll;
        }

        // 同步编辑器滚动到相同比例位置
        const editorMaxScroll = editorTextarea.scrollHeight - editorTextarea.clientHeight;
        if (editorMaxScroll > 0) {
            editorTextarea.scrollTop = savedPreviewRatio * editorMaxScroll;
        }
    });

    // 禁用查看源代码按钮（编辑模式下用不到）
    viewSourceBtn.disabled = true;

    // 注册 Ctrl+S 快捷键
    document.addEventListener('keydown', handleEditKeydown);

    // 注册同步滚动事件
    editorTextarea.addEventListener('scroll', onEditorScroll, { passive: true });
    previewContent.addEventListener('scroll', onPreviewScrollInEdit, { passive: true });
}

async function exitEditMode() {
    // 如果有未保存的改动，提示用户
    if (previewEditUnsaved) {
        if (!confirm(t('unsaved_exit_edit'))) {
            return;
        }
    }

    // 保存退出前的预览滚动比例（在移除 edit-preview 布局之前，clientHeight 会随布局变化）
    const exitMaxScroll = previewContent.scrollHeight - previewContent.clientHeight;
    const exitRatio = exitMaxScroll > 0 ? previewContent.scrollTop / exitMaxScroll : 0;

    isEditingPreview = false;
    previewEditUnsaved = false;

    // 恢复按钮状态
    toggleEditBtn.classList.remove('active');
    const btnText = toggleEditBtn.querySelector('.btn-text');
    if (btnText) btnText.textContent = t('edit');

    // 显示 TOC
    if (previewToc) previewToc.style.display = '';

    // 恢复侧边栏状态（不持久化，保持用户原始偏好）
    setSidebarCollapsed(_sidebarWasCollapsed, false);

    // 移除编辑器位置 class
    const previewBody = document.querySelector('.preview-body');
    if (previewBody) previewBody.classList.remove('editor-right');

    // 隐藏编辑器面板
    previewEditorPane.style.display = 'none';
    previewContent.classList.remove('edit-preview');

    // 恢复查看源代码按钮
    viewSourceBtn.disabled = false;

    // 清除 debounce timer
    if (_editDebounceTimer) {
        clearTimeout(_editDebounceTimer);
        _editDebounceTimer = null;
    }

    // 隐藏“渲染中”图标（如果还在显示）
    hideRenderIndicator();

    // 移除快捷键监听
    document.removeEventListener('keydown', handleEditKeydown);

    // 移除同步滚动监听
    editorTextarea.removeEventListener('scroll', onEditorScroll);
    previewContent.removeEventListener('scroll', onPreviewScrollInEdit);

    // 从服务器重新加载预览（restoreScroll=true 保留阅读位置）
    await previewFile(selectedFile, false, true);

    // 布局稳定后按比例微调，处理内容变更或布局差异导致的偏移
    requestAnimationFrame(() => {
        const afterMaxScroll = previewContent.scrollHeight - previewContent.clientHeight;
        if (afterMaxScroll > 0) {
            previewContent.scrollTop = exitRatio * afterMaxScroll;
        }
    });
}

// ===== 编辑器粘贴图片处理 =====
async function onEditorPasteImage(e) {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;

    // 查找剪贴板中的图片
    let imageItem = null;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
            imageItem = items[i];
            break;
        }
    }
    if (!imageItem) return; // 没有图片，走默认粘贴

    e.preventDefault(); // 阻止默认粘贴行为

    const file = imageItem.getAsFile();
    if (!file) return;

    // 构造文件名：如果剪贴板图片没有名字，使用 paste_时间戳.png
    let filename = file.name || '';
    if (!filename || filename === 'image.png') {
        const ts = new Date().toISOString().replace(/[:.\-T]/g, '').slice(0, 14);
        const ext = file.type.split('/')[1] || 'png';
        filename = `paste_${ts}.${ext}`;
    }

    // 在光标处插入上传占位符
    const textarea = editorTextarea;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const placeholder = `![uploading...]()`;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    textarea.value = before + placeholder + after;
    textarea.selectionStart = textarea.selectionEnd = start + placeholder.length;
    onEditorInput(); // 触发实时预览

    // 上传图片
    const formData = new FormData();
    formData.append('image', file, filename);
    formData.append('file_path', selectedFile || '');

    try {
        const response = await fetch('/api/library/upload-image', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (data.success) {
            // 替换占位符为真实的 Markdown 图片引用
            const markdownImg = `![${data.filename}](${data.markdown_path})`;
            textarea.value = textarea.value.replace(placeholder, markdownImg);
            onEditorInput(); // 触发实时预览更新
        } else {
            // 上传失败，移除占位符
            textarea.value = textarea.value.replace(placeholder, '');
            showError(data.error || '图片上传失败');
        }
    } catch (error) {
        textarea.value = textarea.value.replace(placeholder, '');
        showError('图片上传失败: ' + error.message);
    }
}

// 编辑器输入事件 - 带防抖的实时预览
function onEditorInput() {
    previewEditUnsaved = true;

    // 更新 currentMarkdownSource 以便其他功能使用
    currentMarkdownSource = editorTextarea.value;

    // 防抖渲染：在用户停止输入 1s 后才渲染预览
    // 渲染中动画仅在“真正开始渲染”时才显示，避免用户输入期间频繁闪烁
    if (_editDebounceTimer) clearTimeout(_editDebounceTimer);
    _editDebounceTimer = setTimeout(() => {
        showRenderIndicator();
        // 让动画有机会出现一帧后再进行实际渲染（同步渲染会阻塞下一帧绘制）
        requestAnimationFrame(() => renderLivePreview());
    }, 1000);
}

// 编辑器 textarea 键盘事件：拦截 Tab 键，输入制表符而不是切换焦点
function onEditorTextareaKeydown(e) {
    if (e.key !== 'Tab') return;
    e.preventDefault();

    const ta = editorTextarea;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const value = ta.value;

    // 多行选中时按行缩进 / 反缩进
    if (start !== end && value.substring(start, end).indexOf('\n') !== -1) {
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const before = value.substring(0, lineStart);
        const selected = value.substring(lineStart, end);
        const after = value.substring(end);

        if (e.shiftKey) {
            // 反缩进：移除每行开头的一个制表符或最多 4 个空格
            const replaced = selected.replace(/^(\t| {1,4})/gm, '');
            const removed = selected.length - replaced.length;
            ta.value = before + replaced + after;
            // 调整选区
            const firstLineRemoved = (selected.match(/^(\t| {1,4})/) || [''])[0].length;
            ta.selectionStart = Math.max(lineStart, start - firstLineRemoved);
            ta.selectionEnd = end - removed;
        } else {
            // 缩进：为每行开头添加制表符
            const replaced = selected.replace(/^/gm, '\t');
            const added = replaced.length - selected.length;
            ta.value = before + replaced + after;
            ta.selectionStart = start + 1;
            ta.selectionEnd = end + added;
        }
    } else {
        if (e.shiftKey) {
            // 单行 / 无选区反缩进：移除光标所在行开头的制表符
            const lineStart = value.lastIndexOf('\n', start - 1) + 1;
            const lineHead = value.substring(lineStart, lineStart + 4);
            const m = lineHead.match(/^(\t| {1,4})/);
            if (m) {
                const removed = m[0].length;
                ta.value = value.substring(0, lineStart) + value.substring(lineStart + removed);
                ta.selectionStart = Math.max(lineStart, start - removed);
                ta.selectionEnd = Math.max(lineStart, end - removed);
            }
        } else {
            // 在光标位置插入制表符
            ta.value = value.substring(0, start) + '\t' + value.substring(end);
            ta.selectionStart = ta.selectionEnd = start + 1;
        }
    }

    // 手动触发 input 事件，启动防抖渲染
    ta.dispatchEvent(new Event('input', { bubbles: true }));
}

// 客户端实时渲染 Markdown 预览
function renderLivePreview() {
    const mdText = editorTextarea.value;
    const savedScrollTop = previewContent.scrollTop;

    if (typeof marked === 'undefined') {
        // 如果 marked 未加载，使用简单的转义显示
        const body = getOrCreateMarkdownBody();
        body.innerHTML = `<pre>${escapeHtml(mdText)}</pre>`;
        previewContent.scrollTop = savedScrollTop;
        hideRenderIndicator();
        return;
    }

    try {
        const html = marked.parse(mdText);

        // 只替换 .markdown-body 的子节点，不销毁容器本身，避免滚动容器重建造成闪屏
        const body = getOrCreateMarkdownBody();
        body.innerHTML = html;

        // 修复图片路径：将相对路径转换为 API 路由
        fixImagePaths(body);

        previewContent.scrollTop = savedScrollTop;

        // 添加代码块复制按钮
        addCodeCopyButtons();

        // 添加数学公式复制按钮
        addMathCopyButtons();

        // 渲染 Mermaid 图表
        renderMermaidDiagrams();

        // 触发 MathJax 渲染
        renderMathJax();

        // 重建目录
        buildToc();

        // 布局稳定后兜底恢复一次滚动位置
        requestAnimationFrame(() => {
            previewContent.scrollTop = savedScrollTop;
        });
    } catch (err) {
        console.error('实时预览渲染失败:', err);
        const body = getOrCreateMarkdownBody();
        body.innerHTML = `<pre>${escapeHtml(mdText)}</pre>`;
        previewContent.scrollTop = savedScrollTop;
    } finally {
        // 渲染完成后隐藏“渲染中”动画图标
        hideRenderIndicator();
    }
}

// 获取或创建 previewContent 内的 .markdown-body 容器
function getOrCreateMarkdownBody() {
    let body = previewContent.querySelector('.markdown-body');
    if (!body) {
        body = document.createElement('div');
        body.className = 'markdown-body';
        previewContent.appendChild(body);
    }
    return body;
}

// 修复图片路径：将相对路径的图片 src 转换为通过 API 访问的绝对路径
function fixImagePaths(container) {
    if (!selectedFile) return;

    const fileDir = selectedFile.includes('/') ? selectedFile.substring(0, selectedFile.lastIndexOf('/')) : '';

    container.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src');
        if (!src) return;
        // 跳过已经是绝对 URL 的图片
        if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/api/')) return;
        // 跳过 data: URI
        if (src.startsWith('data:')) return;

        // 拼接相对路径：当前文件目录 + 图片相对路径
        const imagePath = fileDir ? `${fileDir}/${src}` : src;
        img.setAttribute('src', `/api/library/image?path=${encodeURIComponent(imagePath)}`);
    });

    // 为所有图片添加点击放大查看功能
    container.querySelectorAll('img').forEach(img => {
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', (e) => {
            e.preventDefault();
            openImageZoomModal(img, container);
        });
    });
}

// ===== 图片缩放查看模态框 =====
function openImageZoomModal(clickedImg, container) {
    // 收集当前预览区域内所有图片
    const allImages = Array.from(container.querySelectorAll('img'));
    if (!allImages.length) return;
    let currentIndex = allImages.indexOf(clickedImg);
    if (currentIndex < 0) currentIndex = 0;

    // 若已存在则先关闭
    const existing = document.querySelector('.image-zoom-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'image-zoom-modal';
    modal.innerHTML = `
        <div class="image-zoom-content" role="dialog" aria-label="图片查看">
            <div class="image-zoom-toolbar">
                <span class="image-zoom-title">图片查看 <span class="image-zoom-counter"></span></span>
                <div class="image-zoom-actions">
                    <button class="image-zoom-btn" data-act="zoom-out" title="缩小 (-)">−</button>
                    <span class="image-zoom-scale">100%</span>
                    <button class="image-zoom-btn" data-act="zoom-in" title="放大 (+)">+</button>
                    <button class="image-zoom-btn" data-act="fit" title="适应窗口 (0)">适应</button>
                    <button class="image-zoom-btn" data-act="reset" title="实际大小 (1)">1:1</button>
                    <button class="image-zoom-btn image-zoom-close" data-act="close" title="关闭 (Esc)">✕</button>
                </div>
            </div>
            <div class="image-zoom-viewport">
                <button type="button" class="image-zoom-nav image-zoom-prev" data-act="prev" title="上一张 (←)" aria-label="上一张">
                    <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/></svg>
                </button>
                <div class="image-zoom-stage"></div>
                <button type="button" class="image-zoom-nav image-zoom-next" data-act="next" title="下一张 (→)" aria-label="下一张">
                    <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/></svg>
                </button>
            </div>
            <div class="image-zoom-hint">滚轮缩放 · 拖动平移 · 双击适应 · ←/→ 切换 · Esc 关闭</div>
        </div>
    `;
    document.body.appendChild(modal);

    const viewport = modal.querySelector('.image-zoom-viewport');
    const stage = modal.querySelector('.image-zoom-stage');
    const scaleLabel = modal.querySelector('.image-zoom-scale');
    const counterLabel = modal.querySelector('.image-zoom-counter');
    const prevBtn = modal.querySelector('.image-zoom-prev');
    const nextBtn = modal.querySelector('.image-zoom-next');

    const MIN_SCALE = 0.1;
    const MAX_SCALE = 20;
    let imgW = 0, imgH = 0;
    let scale = 1, tx = 0, ty = 0;

    function loadImage(img) {
        return new Promise((resolve) => {
            const newImg = new Image();
            newImg.onload = () => {
                imgW = newImg.naturalWidth || newImg.width;
                imgH = newImg.naturalHeight || newImg.height;
                newImg.className = 'image-zoom-img';
                newImg.draggable = false;
                stage.innerHTML = '';
                stage.appendChild(newImg);
                resolve(true);
            };
            newImg.onerror = () => resolve(false);
            newImg.src = img.src;
        });
    }

    function applyTransform() {
        const w = imgW * scale;
        const h = imgH * scale;
        stage.style.width = w + 'px';
        stage.style.height = h + 'px';
        stage.style.transform = `translate(${tx}px, ${ty}px)`;
        const imgEl = stage.querySelector('img');
        if (imgEl) {
            imgEl.style.width = w + 'px';
            imgEl.style.height = h + 'px';
        }
        scaleLabel.textContent = Math.round(scale * 100) + '%';
    }

    function fitToViewport() {
        const rect = viewport.getBoundingClientRect();
        const padding = 40;
        const sx = (rect.width - padding) / imgW;
        const sy = (rect.height - padding) / imgH;
        scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(sx, sy)));
        tx = (rect.width - imgW * scale) / 2;
        ty = (rect.height - imgH * scale) / 2;
        applyTransform();
    }

    function resetTo100() {
        const rect = viewport.getBoundingClientRect();
        scale = 1;
        tx = (rect.width - imgW) / 2;
        ty = (rect.height - imgH) / 2;
        applyTransform();
    }

    function zoomAtPoint(cx, cy, factor) {
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor));
        if (newScale === scale) return;
        const ratio = newScale / scale;
        tx = cx - (cx - tx) * ratio;
        ty = cy - (cy - ty) * ratio;
        scale = newScale;
        applyTransform();
    }

    function updateNavState() {
        if (allImages.length <= 1) {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
            counterLabel.textContent = '';
            return;
        }
        prevBtn.style.display = '';
        nextBtn.style.display = '';
        prevBtn.disabled = currentIndex <= 0;
        nextBtn.disabled = currentIndex >= allImages.length - 1;
        counterLabel.textContent = `(${currentIndex + 1}/${allImages.length})`;
    }

    async function gotoIndex(idx) {
        if (idx < 0 || idx >= allImages.length || idx === currentIndex) return;
        const ok = await loadImage(allImages[idx]);
        if (ok) {
            currentIndex = idx;
            updateNavState();
            requestAnimationFrame(fitToViewport);
        }
    }

    // 初始化加载
    (async () => {
        await loadImage(allImages[currentIndex]);
        updateNavState();
        requestAnimationFrame(fitToViewport);
    })();

    // 滚轮缩放
    function onWheel(e) {
        e.preventDefault();
        const rect = viewport.getBoundingClientRect();
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        zoomAtPoint(e.clientX - rect.left, e.clientY - rect.top, factor);
    }
    viewport.addEventListener('wheel', onWheel, { passive: false });

    // 拖拽平移
    let dragging = false, dragSX = 0, dragSY = 0, origTx = 0, origTy = 0;
    function onMouseDown(e) {
        if (e.button !== 0) return;
        if (e.target.closest('.image-zoom-nav')) return;
        dragging = true;
        dragSX = e.clientX; dragSY = e.clientY;
        origTx = tx; origTy = ty;
        viewport.classList.add('dragging');
        e.preventDefault();
    }
    function onMouseMove(e) {
        if (!dragging) return;
        tx = origTx + (e.clientX - dragSX);
        ty = origTy + (e.clientY - dragSY);
        applyTransform();
    }
    function onMouseUp() {
        if (!dragging) return;
        dragging = false;
        viewport.classList.remove('dragging');
    }
    viewport.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // 双击适应
    viewport.addEventListener('dblclick', fitToViewport);

    // 工具栏按钮
    modal.querySelectorAll('.image-zoom-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const act = btn.getAttribute('data-act');
            const rect = viewport.getBoundingClientRect();
            const cx = rect.width / 2, cy = rect.height / 2;
            if (act === 'zoom-in') zoomAtPoint(cx, cy, 1.2);
            else if (act === 'zoom-out') zoomAtPoint(cx, cy, 1 / 1.2);
            else if (act === 'fit') fitToViewport();
            else if (act === 'reset') resetTo100();
            else if (act === 'close') close();
        });
    });

    // 左右导航
    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); gotoIndex(currentIndex - 1); });
    nextBtn.addEventListener('click', (e) => { e.stopPropagation(); gotoIndex(currentIndex + 1); });

    // 点击遮罩关闭
    modal.addEventListener('mousedown', (e) => {
        if (e.target === modal) close();
    });

    // 键盘快捷键
    function onKeydown(e) {
        if (e.key === 'Escape') { close(); return; }
        if (e.key === 'ArrowLeft') { gotoIndex(currentIndex - 1); e.preventDefault(); return; }
        if (e.key === 'ArrowRight') { gotoIndex(currentIndex + 1); e.preventDefault(); return; }
        if (e.key === '+' || e.key === '=') {
            const rect = viewport.getBoundingClientRect();
            zoomAtPoint(rect.width / 2, rect.height / 2, 1.2);
        } else if (e.key === '-') {
            const rect = viewport.getBoundingClientRect();
            zoomAtPoint(rect.width / 2, rect.height / 2, 1 / 1.2);
        } else if (e.key === '0') {
            fitToViewport();
        } else if (e.key === '1') {
            resetTo100();
        }
    }
    document.addEventListener('keydown', onKeydown);

    function close() {
        document.removeEventListener('keydown', onKeydown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        modal.remove();
    }
}

// 渲染中动画硬编码最小显示时间（1s）
const RENDER_INDICATOR_MIN_DURATION = 1000;
let _renderShownAt = 0;
let _renderHideTimer = null;

// 显示预览渲染中动画图标
function showRenderIndicator() {
    if (!renderIndicator) return;
    // 取消未完成的延迟隐藏
    if (_renderHideTimer) {
        clearTimeout(_renderHideTimer);
        _renderHideTimer = null;
    }
    _renderShownAt = Date.now();
    renderIndicator.style.display = '';
    // 下一帧才添加 show 以触发过渡动画
    requestAnimationFrame(() => {
        renderIndicator.classList.add('show');
    });
}

// 隐藏预览渲染中动画图标：保证至少显示 1s
function hideRenderIndicator() {
    if (!renderIndicator) return;
    // 计算已显示时长，不足最小时长则延迟隐藏
    const elapsed = _renderShownAt ? Date.now() - _renderShownAt : RENDER_INDICATOR_MIN_DURATION;
    const remain = Math.max(0, RENDER_INDICATOR_MIN_DURATION - elapsed);
    if (_renderHideTimer) {
        clearTimeout(_renderHideTimer);
        _renderHideTimer = null;
    }
    const doHide = () => {
        renderIndicator.classList.remove('show');
        _renderShownAt = 0;
        // 过渡结束后隐藏元素
        setTimeout(() => {
            if (!renderIndicator.classList.contains('show')) {
                renderIndicator.style.display = 'none';
            }
        }, 220);
    };
    if (remain > 0) {
        _renderHideTimer = setTimeout(() => {
            _renderHideTimer = null;
            doHide();
        }, remain);
    } else {
        doHide();
    }
}

// 显示保存指示器（3秒动画提示）
function showSaveIndicator() {
    if (!saveIndicator) return;
    // 清除之前的定时器
    if (_saveIndicatorTimer) {
        clearTimeout(_saveIndicatorTimer);
        _saveIndicatorTimer = null;
    }
    // 重置动画
    saveIndicator.classList.remove('show', 'pop');
    void saveIndicator.offsetWidth; // 强制回流
    // 显示并弹出动画
    saveIndicator.style.display = '';
    saveIndicator.classList.add('show', 'pop');
    // 3秒后隐藏
    _saveIndicatorTimer = setTimeout(() => {
        saveIndicator.classList.remove('show', 'pop');
        // 过渡结束后隐藏元素
        setTimeout(() => {
            if (!saveIndicator.classList.contains('show')) {
                saveIndicator.style.display = 'none';
            }
        }, 300);
        _saveIndicatorTimer = null;
    }, 3000);
}

// Ctrl+S 保存
async function saveEditAndPreview() {
    if (!selectedFile) return;

    const newContent = editorTextarea.value;

    try {
        const response = await fetch('/api/library/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: selectedFile, content: newContent })
        });

        const data = await response.json();

        if (data.success) {
            showSaveIndicator();
            currentMarkdownSource = newContent;
            previewEditUnsaved = false;
        } else {
            showError(data.error || t('save_fail'));
        }
    } catch (error) {
        showError(t('save_fail') + ': ' + error.message);
    }
}

// 取消编辑模式
function cancelEditMode() {
    exitEditMode();
}

// 强制退出编辑模式（不提示保存）
function forceExitEditMode() {
    isEditingPreview = false;
    previewEditUnsaved = false;

    toggleEditBtn.classList.remove('active');
    const btnText = toggleEditBtn.querySelector('.btn-text');
    if (btnText) btnText.textContent = t('edit');

    if (previewToc) previewToc.style.display = '';

    // 恢复侧边栏状态（不持久化，保持用户原始偏好）
    setSidebarCollapsed(_sidebarWasCollapsed, false);

    // 移除编辑器位置 class
    const previewBody = document.querySelector('.preview-body');
    if (previewBody) previewBody.classList.remove('editor-right');

    previewEditorPane.style.display = 'none';
    previewContent.classList.remove('edit-preview');
    viewSourceBtn.disabled = false;

    if (_editDebounceTimer) {
        clearTimeout(_editDebounceTimer);
        _editDebounceTimer = null;
    }
    document.removeEventListener('keydown', handleEditKeydown);
    editorTextarea.removeEventListener('scroll', onEditorScroll);
    previewContent.removeEventListener('scroll', onPreviewScrollInEdit);
}

// 切换编辑器位置（左/右）
function toggleEditorPosition() {
    _editorPosition = _editorPosition === 'left' ? 'right' : 'left';
    try { localStorage.setItem('editorPosition', _editorPosition); } catch (e) {}
    applyEditorPosition();
}

// 加载编辑器位置设置
function loadEditorPosition() {
    try {
        const saved = localStorage.getItem('editorPosition');
        if (saved === 'right' || saved === 'left') {
            _editorPosition = saved;
        }
    } catch (e) {}
}

// 应用编辑器位置（通过 class 控制 CSS）
function applyEditorPosition() {
    const previewBody = document.querySelector('.preview-body');
    if (!previewBody) return;
    if (_editorPosition === 'right') {
        previewBody.classList.add('editor-right');
    } else {
        previewBody.classList.remove('editor-right');
    }
}

// 设置侧边栏收起/展开
// save: 是否持久化到 localStorage（用户手动切换时保存，自动收起/恢复时不保存）
function setSidebarCollapsed(collapsed, save = true) {
    const appContainer = document.querySelector('.app-container');
    const collapseIcon = document.getElementById('collapseIcon');
    const expandIcon = document.getElementById('expandIcon');
    if (!appContainer) return;

    if (collapsed) {
        appContainer.classList.add('sidebar-collapsed');
    } else {
        appContainer.classList.remove('sidebar-collapsed');
    }

    if (collapseIcon && expandIcon) {
        collapseIcon.style.display = collapsed ? 'none' : 'block';
        expandIcon.style.display = collapsed ? 'block' : 'none';
    }

    if (save) {
        try { localStorage.setItem('sidebarCollapsed', collapsed ? 'true' : 'false'); } catch (e) {}
    }
}

// 编辑器滚动时同步预览滚动
function onEditorScroll() {
    if (_syncScrolling) return;
    _syncScrolling = true;

    const editor = editorTextarea;
    const preview = previewContent;

    // 计算编辑器滚动比例
    const editorMaxScroll = editor.scrollHeight - editor.clientHeight;
    if (editorMaxScroll <= 0) { _syncScrolling = false; return; }
    const editorRatio = editor.scrollTop / editorMaxScroll;

    // 应用到预览区域
    const previewMaxScroll = preview.scrollHeight - preview.clientHeight;
    preview.scrollTop = editorRatio * previewMaxScroll;

    requestAnimationFrame(() => { _syncScrolling = false; });
}

// 预览滚动时同步编辑器滚动
function onPreviewScrollInEdit() {
    if (_syncScrolling) return;
    _syncScrolling = true;

    const editor = editorTextarea;
    const preview = previewContent;

    // 计算预览滚动比例
    const previewMaxScroll = preview.scrollHeight - preview.clientHeight;
    if (previewMaxScroll <= 0) { _syncScrolling = false; return; }
    const previewRatio = preview.scrollTop / previewMaxScroll;

    // 应用到编辑器
    const editorMaxScroll = editor.scrollHeight - editor.clientHeight;
    editor.scrollTop = previewRatio * editorMaxScroll;

    requestAnimationFrame(() => { _syncScrolling = false; });
}

// 处理编辑模式下的键盘快捷键
function handleEditKeydown(e) {
    // Ctrl+S 或 Cmd+S 保存
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveEditAndPreview();
    }
    // Escape 退出编辑
    if (e.key === 'Escape') {
        e.preventDefault();
        exitEditMode();
    }
}

// ===== 搜索功能 =====

// 切换搜索栏
function toggleSearch() {
    const isVisible = searchBar.style.display !== 'none';
    if (isVisible) {
        closeSearch();
    } else {
        searchBar.style.display = 'flex';
        searchInput.value = '';
        searchInput.focus();
    }
}

// 关闭搜索
function closeSearch() {
    searchBar.style.display = 'none';
    searchInput.value = '';
    // 清除搜索高亮
    document.querySelectorAll('.file-item').forEach(item => {
        item.classList.remove('search-match');
        item.style.display = '';
    });
    // 移除"无搜索结果"提示
    const existingNoResult = fileList.querySelector('.no-search-result');
    if (existingNoResult) {
        existingNoResult.remove();
    }
}

// 处理搜索
function handleSearch(event) {
    const query = event.target.value.trim().toLowerCase();
    const fileItems = document.querySelectorAll('.file-item');
    
    // 移除之前的"无搜索结果"提示
    const existingNoResult = fileList.querySelector('.no-search-result');
    if (existingNoResult) {
        existingNoResult.remove();
    }
    
    if (!query) {
        // 清空搜索，显示所有文件
        fileItems.forEach(item => {
            item.classList.remove('search-match');
            item.style.display = '';
        });
        return;
    }
    
    // 搜索并高亮匹配项
    let hasMatch = false;
    fileItems.forEach(item => {
        const fileName = item.querySelector('.file-name').textContent.toLowerCase();
        if (fileName.includes(query)) {
            item.classList.add('search-match');
            item.style.display = '';
            hasMatch = true;
        } else {
            item.classList.remove('search-match');
            item.style.display = 'none';
        }
    });
    
    // 如果没有匹配结果，显示"无搜索结果"
    if (!hasMatch) {
        const noResultDiv = document.createElement('div');
        noResultDiv.className = 'no-search-result';
        noResultDiv.innerHTML = `
            <svg width="48" height="48" viewBox="0 0 16 16" fill="currentColor" style="opacity: 0.3; margin-bottom: 16px;">
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
            </svg>
            <p style="color: var(--text-secondary); font-size: 15px;">${t('no_search_result')}</p>
            <p style="color: var(--text-secondary); font-size: 13px; margin-top: 8px;">${t('no_search_hint')}</p>
        `;
        fileList.appendChild(noResultDiv);
    }
}

// ===== 侧边栏折叠功能 =====

// 切换侧边栏显示/隐藏
function toggleSidebar() {
    const appContainer = document.querySelector('.app-container');
    const collapseIcon = document.getElementById('collapseIcon');
    const expandIcon = document.getElementById('expandIcon');
    
    const isCollapsed = appContainer.classList.toggle('sidebar-collapsed');
    
    // 切换图标
    if (collapseIcon && expandIcon) {
        collapseIcon.style.display = isCollapsed ? 'none' : 'block';
        expandIcon.style.display = isCollapsed ? 'block' : 'none';
    }
    
    // 保存状态到本地存储
    localStorage.setItem('sidebarCollapsed', isCollapsed ? 'true' : 'false');
}

// 加载侧边栏状态
function loadSidebarState() {
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    const appContainer = document.querySelector('.app-container');
    const collapseIcon = document.getElementById('collapseIcon');
    const expandIcon = document.getElementById('expandIcon');
    
    if (isCollapsed && appContainer) {
        appContainer.classList.add('sidebar-collapsed');
        if (collapseIcon && expandIcon) {
            collapseIcon.style.display = 'none';
            expandIcon.style.display = 'block';
        }
    }
    
    // 绑定按钮点击事件
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', toggleSidebar);
    }

    // 侧边栏内部的收起按钮，也复用同一个切换函数
    const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
    if (sidebarCollapseBtn) {
        sidebarCollapseBtn.addEventListener('click', toggleSidebar);
    }
}

// ===== 设置弹窗功能 =====

function openSettingsModal() {
    const langSelect = document.getElementById('settingsLanguageSelect');
    langSelect.value = localStorage.getItem('appLanguage') || 'zh-CN';
    updateThemeUI();
    if (typeof updateMermaidStyleUI === 'function') updateMermaidStyleUI();
    settingsModal.classList.add('show');
}

function closeSettingsModal() {
    settingsModal.classList.remove('show');
}

function setTheme(theme) {
    document.body.classList.remove('dark-mode', 'blue-mode', 'pink-mode');
    if (theme === 'dark') document.body.classList.add('dark-mode');
    else if (theme === 'blue') document.body.classList.add('blue-mode');
    else if (theme === 'pink') document.body.classList.add('pink-mode');
    localStorage.setItem('theme', theme);
    updateThemeUI();
    // 主题切换后同步重新初始化并重渲染预览区 Mermaid 图表
    try { refreshMermaidTheme(); } catch (e) { console.warn('Mermaid 主题刷新失败:', e); }
}

// 重新生成 Mermaid 配置并刷新预览区已渲染的图表
function refreshMermaidTheme() {
    if (typeof buildMermaidConfig === 'function') {
        MERMAID_CONFIG = buildMermaidConfig();
        window.MERMAID_CONFIG = MERMAID_CONFIG;
    }
    if (window.mermaid) {
        try { mermaid.initialize(MERMAID_CONFIG); } catch (e) { /* ignore */ }
    }
    // 将预览区已渲染的 .mermaid-container 还原为 <pre><code> 后重新渲染
    var preview = (typeof previewContent !== 'undefined' && previewContent) ||
                  document.getElementById('preview-content');
    if (!preview) return;
    var containers = preview.querySelectorAll('.mermaid-container');
    if (!containers.length) return;
    containers.forEach(function (c) {
        var src = c.getAttribute('data-mermaid-source') || '';
        var pre = document.createElement('pre');
        var code = document.createElement('code');
        code.className = 'language-mermaid';
        code.textContent = src;
        pre.appendChild(code);
        c.parentNode.replaceChild(pre, c);
    });
    if (typeof renderMermaidDiagrams === 'function') {
        renderMermaidDiagrams();
    }
}

function updateThemeUI() {
    const current = localStorage.getItem('theme') || 'light';
    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.theme === current);
    });
}

function setLanguage(lang) {
    localStorage.setItem('appLanguage', lang);
    applyLanguage();
}

function loadTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    setTheme(saved);
    applyLanguage();
}

// ===== Mermaid 风格预设 =====
function setMermaidStyle(styleKey) {
    if (!MERMAID_STYLE_PRESETS[styleKey]) styleKey = MERMAID_STYLE_DEFAULT;
    try { localStorage.setItem(MERMAID_STYLE_KEY, styleKey); } catch (e) {}
    updateMermaidStyleUI();
    try { refreshMermaidTheme(); } catch (e) { console.warn('Mermaid 风格应用失败:', e); }
}

function updateMermaidStyleUI() {
    var current = getCurrentMermaidStyle();
    document.querySelectorAll('.mermaid-style-option').forEach(function (opt) {
        opt.classList.toggle('active', opt.dataset.mermaidStyle === current);
    });
}

function loadMermaidStyle() {
    updateMermaidStyleUI();
}

// ===== 新建选择功能 =====

// 打开新建选择模态框
function openNewSelectModal() {
    newSelectModal.classList.add('show');
}

// 关闭新建选择模态框
function closeNewSelectModal() {
    newSelectModal.classList.remove('show');
}

// 选择新建类型
function selectNewType(type) {
    closeNewSelectModal();
    
    if (type === 'file') {
        openNewFileModal();
    } else if (type === 'folder') {
        openNewFolderModal();
    }
}

// ===== 新建文件功能 =====

// 打开新建文件模态框
function openNewFileModal() {
    newFileModal.classList.add('show');
    document.getElementById('fileNameInput').value = '';
    document.getElementById('fileExtensionSelect').value = 'md'; // 默认选择.md
    document.getElementById('fileNameInput').focus();
}

// 关闭新建文件模态框
function closeNewFileModal() {
    newFileModal.classList.remove('show');
}

// 创建文件
async function createFile() {
    const nameInput = document.getElementById('fileNameInput').value.trim();
    const extension = document.getElementById('fileExtensionSelect').value;
    
    if (!nameInput) {
        showError(t('enter_file_name'));
        return;
    }
    
    // 检查文件名中是否包含非法字符
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(nameInput)) {
        showError(t('invalid_chars'));
        return;
    }
    
    // 组合完整文件名（去掉用户可能输入的扩展名，使用选择的扩展名）
    let baseName = nameInput;
    // 如果用户输入了扩展名，去掉它
    const dotIndex = nameInput.lastIndexOf('.');
    if (dotIndex > 0) {
        const inputExt = nameInput.substring(dotIndex + 1).toLowerCase();
        if (['md', 'markdown', 'txt'].includes(inputExt)) {
            baseName = nameInput.substring(0, dotIndex);
        }
    }
    
    const fullName = baseName + '.' + extension;
    
    try {
        const response = await fetch('/api/library/create-file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: fullName,
                path: currentPath
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess(t('file_create_success'));
            closeNewFileModal();
            loadLibrary(currentPath);
        } else {
            showError(data.error || t('create_fail'));
        }
    } catch (error) {
        showError(t('create_fail') + ': ' + error.message);
    }
}

// 打开新建文件夹模态框（保持原来的函数名）
function openNewFolderModal() {
    newFolderModal.classList.add('show');
    document.getElementById('folderNameInput').value = '';
    document.getElementById('folderNameInput').focus();
}


// 工具函数
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return t('just_now');
    if (diff < 3600000) return t('minutes_ago', {n: Math.floor(diff / 60000)});
    if (diff < 86400000) return t('hours_ago', {n: Math.floor(diff / 3600000)});
    if (diff < 604800000) return t('days_ago', {n: Math.floor(diff / 86400000)});
    
    const lang = localStorage.getItem('appLanguage') || 'zh-CN';
    return date.toLocaleDateString(lang);
}

function showSuccess(message) {
    alert('✅ ' + message);
}

function showError(message) {
    alert('❌ ' + message);
}

// ===== 查看源代码功能 =====

// 打开源代码模态框
function openSourceModal() {
    if (!currentMarkdownSource) {
        showError(t('no_source'));
            return;
        }

    const codeElement = document.querySelector('#sourceContent code');
    codeElement.textContent = currentMarkdownSource;
    sourceModal.classList.add('show');
}

// 复制源代码
async function copySourceCode() {
    const success = await copyToClipboard(currentMarkdownSource);
    if (success) {
        showSuccess(t('copy_success'));
    } else {
        showError(t('copy_fail'));
    }
}

// ===== 新增功能：代码复制、Mermaid、数学公式复制 =====

// 渲染MathJax数学公式（带加载检测）
async function renderMathJax() {
    // 检查MathJax是否已加载
    if (!window.MathJax) {
        console.warn('⚠️ MathJax库未加载，等待加载...');
        // 等待MathJax加载
        await new Promise(resolve => {
            const checkMathJax = setInterval(() => {
                if (window.MathJax && window.MathJax.typesetPromise) {
                    clearInterval(checkMathJax);
                    console.log('✅ MathJax库已加载');
                    resolve();
                }
            }, 100);
            // 超时保护（10秒）
            setTimeout(() => {
                clearInterval(checkMathJax);
                console.warn('⚠️ MathJax加载超时');
                resolve();
            }, 10000);
        });
    }
    
    // 再次检查MathJax及其typesetPromise是否可用
    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
        try {
            await MathJax.typesetPromise([previewContent]);
            console.log('✅ MathJax渲染完成');
        } catch (err) {
            console.error('❌ MathJax渲染失败:', err);
        }
    } else if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
        // 如果typesetPromise还不可用，等待startup完成
        try {
            await MathJax.startup.promise;
            if (typeof MathJax.typesetPromise === 'function') {
                await MathJax.typesetPromise([previewContent]);
                console.log('✅ MathJax渲染完成（通过startup）');
            }
        } catch (err) {
            console.error('❌ MathJax渲染失败:', err);
        }
    } else {
        console.warn('⚠️ MathJax不可用或未正确加载');
    }
}

// ===== 目录栏 (TOC) =====
let _tocItems = []; // [{ id, el, btn, level }]
let _tocScrollRaf = 0;
let _tocLevelFilters = { '1': true, '2': true, '3': true, 'other': true };
// 点击目录项跳转时，暂停目录栏自身的自动滚动；scrollTo 为平滑动画，需维持一小段时间
let _suppressTocScroll = false;
let _suppressTocScrollTimer = 0;

function _tocLevelKey(level) {
    return level <= 3 ? String(level) : 'other';
}

function loadTocLevelFilters() {
    try {
        const raw = localStorage.getItem('tocLevelFilters');
        if (raw) {
            const parsed = JSON.parse(raw);
            ['1', '2', '3', 'other'].forEach(k => {
                if (typeof parsed[k] === 'boolean') _tocLevelFilters[k] = parsed[k];
            });
        }
    } catch (e) {}
    // 初始化按钮高亮
    document.querySelectorAll('.toc-level-btn').forEach(btn => {
        btn.classList.toggle('active', !!_tocLevelFilters[btn.dataset.level]);
    });
}

function _saveTocLevelFilters() {
    try { localStorage.setItem('tocLevelFilters', JSON.stringify(_tocLevelFilters)); } catch (e) {}
}

function applyTocLevelFilter() {
    _tocItems.forEach(item => {
        const key = _tocLevelKey(item.level);
        item.btn.classList.toggle('hidden', !_tocLevelFilters[key]);
    });
    document.querySelectorAll('.toc-level-btn').forEach(btn => {
        btn.classList.toggle('active', !!_tocLevelFilters[btn.dataset.level]);
    });
}

function toggleTocLevel(key) {
    if (!(key in _tocLevelFilters)) return;
    _tocLevelFilters[key] = !_tocLevelFilters[key];
    _saveTocLevelFilters();
    applyTocLevelFilter();
}

function _slugify(text) {
    return (text || '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[\s]+/g, '-')
        .replace(/[^\p{L}\p{N}\-_]+/gu, '')
        .replace(/^-+|-+$/g, '') || 'section';
}

function buildToc() {
    if (!previewTocList || !previewContent) return;
    const headings = previewContent.querySelectorAll('.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6');
    previewTocList.innerHTML = '';
    _tocItems = [];

    if (!headings.length) {
        const empty = document.createElement('div');
        empty.className = 'preview-toc-empty';
        empty.textContent = (typeof t === 'function') ? t('toc_empty') : '暂无目录';
        previewTocList.appendChild(empty);
        return;
    }

    const usedIds = new Set();
    const fragment = document.createDocumentFragment();
    headings.forEach((h, idx) => {
        let id = h.id;
        if (!id) id = _slugify(h.textContent) || ('section-' + idx);
        let uniqueId = id;
        let n = 1;
        while (usedIds.has(uniqueId)) {
            uniqueId = id + '-' + (++n);
        }
        usedIds.add(uniqueId);
        h.id = uniqueId;

        const level = parseInt(h.tagName.substring(1), 10) || 1;
        const btn = document.createElement('a');
        btn.className = 'preview-toc-item level-' + level;
        btn.href = '#' + uniqueId;
        btn.textContent = (h.textContent || '').trim();
        btn.title = btn.textContent;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            scrollHeadingIntoView(h);
        });
        fragment.appendChild(btn);
        _tocItems.push({ id: uniqueId, el: h, btn, level });
    });
    previewTocList.appendChild(fragment);
    applyTocLevelFilter();
    updateTocActive();
}

function scrollHeadingIntoView(headingEl) {
    if (!headingEl || !previewContent) return;
    // 抑制目录栏的自动滚动，避免跳转时目录栏跟着滚
    _suppressTocScroll = true;
    if (_suppressTocScrollTimer) clearTimeout(_suppressTocScrollTimer);
    _suppressTocScrollTimer = setTimeout(() => {
        _suppressTocScroll = false;
        _suppressTocScrollTimer = 0;
    }, 800);

    const containerTop = previewContent.getBoundingClientRect().top;
    const headingTop = headingEl.getBoundingClientRect().top;
    const target = previewContent.scrollTop + (headingTop - containerTop) - 8;
    previewContent.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
}

function onPreviewScroll() {
    if (_tocScrollRaf) return;
    _tocScrollRaf = requestAnimationFrame(() => {
        _tocScrollRaf = 0;
        updateTocActive();
    });
}

function updateTocActive() {
    if (!_tocItems.length || !previewContent) return;
    const containerTop = previewContent.getBoundingClientRect().top;
    let activeIdx = 0;
    for (let i = 0; i < _tocItems.length; i++) {
        const top = _tocItems[i].el.getBoundingClientRect().top - containerTop;
        if (top - 24 <= 0) {
            activeIdx = i;
        } else {
            break;
        }
    }
    _tocItems.forEach((item, i) => {
        item.btn.classList.toggle('active', i === activeIdx);
    });
    const activeBtn = _tocItems[activeIdx] && _tocItems[activeIdx].btn;
    if (!_suppressTocScroll && activeBtn && previewTocList) {
        const btnRect = activeBtn.getBoundingClientRect();
        const listRect = previewTocList.getBoundingClientRect();
        if (btnRect.top < listRect.top || btnRect.bottom > listRect.bottom) {
            // 在目录栏容器内部滚动，避免影响外层页面滚动位置
            const target = previewTocList.scrollTop + (btnRect.top - listRect.top) - 8;
            previewTocList.scrollTo({ top: Math.max(0, target) });
        }
    }
}

function setTocVisible(visible) {
    if (!previewPanel) return;
    previewPanel.classList.toggle('toc-collapsed', !visible);
    try { localStorage.setItem('tocVisible', visible ? '1' : '0'); } catch (e) {}
    if (visible) updateTocActive();
}

function toggleToc() {
    if (!previewPanel) return;
    const visible = previewPanel.classList.contains('toc-collapsed');
    setTocVisible(visible);
}

function loadTocState() {
    if (!previewPanel) return;
    const stored = (function () { try { return localStorage.getItem('tocVisible'); } catch (e) { return null; } })();
    const visible = stored === '1';
    previewPanel.classList.toggle('toc-collapsed', !visible);
}

// Mermaid 统一配置 - 覆盖所有支持的图表类型
// 使用 base 主题 + 自定义 themeVariables，多风格预设可选
var MERMAID_FONT_DEFAULT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif';
var MERMAID_FONT_HANDDRAWN = '"Caveat", "Comic Sans MS", "Marker Felt", "PingFang SC", "Microsoft YaHei", cursive';
var MERMAID_FONT_MONO = '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, "PingFang SC", "Microsoft YaHei", monospace';
var MERMAID_FONT_NOTION = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif';
// 兼容历史变量名
var MERMAID_FONT_FAMILY = MERMAID_FONT_DEFAULT;

// 经典蓝（默认）- 浅色 themeVariables
var MERMAID_LIGHT_VARS = {
    fontFamily: MERMAID_FONT_FAMILY,
    fontSize: '14px',
    background: 'transparent',
    // 通用节点
    primaryColor: '#dbeafe',
    primaryTextColor: '#1e3a5f',
    primaryBorderColor: '#3b82f6',
    secondaryColor: '#fef3c7',
    secondaryTextColor: '#92400e',
    secondaryBorderColor: '#f59e0b',
    tertiaryColor: '#dcfce7',
    tertiaryTextColor: '#14532d',
    tertiaryBorderColor: '#10b981',
    lineColor: '#64748b',
    mainBkg: '#dbeafe',
    secondBkg: '#fef3c7',
    tertiaryBkg: '#dcfce7',
    nodeBorder: '#3b82f6',
    nodeTextColor: '#1e3a5f',
    clusterBkg: '#f8fafc',
    clusterBorder: '#cbd5e1',
    titleColor: '#1e293b',
    edgeLabelBackground: '#ffffff',
    // 时序图
    actorBkg: '#dbeafe',
    actorBorder: '#3b82f6',
    actorTextColor: '#1e3a5f',
    actorLineColor: '#94a3b8',
    signalColor: '#475569',
    signalTextColor: '#1e293b',
    labelBoxBkgColor: '#fef3c7',
    labelBoxBorderColor: '#f59e0b',
    labelTextColor: '#92400e',
    loopTextColor: '#1e293b',
    noteBkgColor: '#fef9c3',
    noteTextColor: '#713f12',
    noteBorderColor: '#facc15',
    activationBkgColor: '#bfdbfe',
    activationBorderColor: '#3b82f6',
    // 状态图 / 类图
    altBackground: '#f1f5f9',
    classText: '#1e293b',
    // 饼图配色
    pie1: '#3b82f6', pie2: '#10b981', pie3: '#f59e0b', pie4: '#ec4899',
    pie5: '#8b5cf6', pie6: '#06b6d4', pie7: '#f43f5e', pie8: '#84cc16',
    pie9: '#0ea5e9', pie10: '#eab308', pie11: '#a855f7', pie12: '#14b8a6',
    pieTitleTextColor: '#1e293b',
    pieSectionTextColor: '#ffffff',
    pieLegendTextColor: '#475569',
    pieStrokeColor: '#ffffff',
    pieOuterStrokeColor: '#cbd5e1',
    pieOpacity: '0.95',
    // 甘特图
    sectionBkgColor: '#dbeafe',
    altSectionBkgColor: '#fef3c7',
    gridColor: '#e2e8f0',
    todayLineColor: '#ef4444',
    taskBkgColor: '#3b82f6',
    taskTextColor: '#ffffff',
    taskTextDarkColor: '#1e293b',
    taskTextOutsideColor: '#1e293b',
    taskTextLightColor: '#ffffff',
    taskTextClickableColor: '#ffffff',
    doneTaskBkgColor: '#94a3b8',
    doneTaskBorderColor: '#475569',
    activeTaskBkgColor: '#3b82f6',
    activeTaskBorderColor: '#1d4ed8',
    critBorderColor: '#dc2626',
    critBkgColor: '#fecaca',
    // git
    git0: '#3b82f6', git1: '#10b981', git2: '#f59e0b', git3: '#ec4899',
    git4: '#8b5cf6', git5: '#06b6d4', git6: '#f43f5e', git7: '#84cc16',
    gitBranchLabel0: '#ffffff', gitBranchLabel1: '#ffffff', gitBranchLabel2: '#ffffff',
    gitBranchLabel3: '#ffffff', gitBranchLabel4: '#ffffff', gitBranchLabel5: '#ffffff',
    gitBranchLabel6: '#ffffff', gitBranchLabel7: '#ffffff'
};

// 经典蓝 - 深色 themeVariables
var MERMAID_DARK_VARS = {
    fontFamily: MERMAID_FONT_FAMILY,
    fontSize: '14px',
    darkMode: true,
    background: 'transparent',
    primaryColor: '#1e3a5f',
    primaryTextColor: '#e2e8f0',
    primaryBorderColor: '#3b82f6',
    secondaryColor: '#3f2a0a',
    secondaryTextColor: '#fde68a',
    secondaryBorderColor: '#f59e0b',
    tertiaryColor: '#14352a',
    tertiaryTextColor: '#bbf7d0',
    tertiaryBorderColor: '#10b981',
    lineColor: '#94a3b8',
    mainBkg: '#1e3a5f',
    secondBkg: '#3f2a0a',
    tertiaryBkg: '#14352a',
    nodeBorder: '#3b82f6',
    nodeTextColor: '#e2e8f0',
    clusterBkg: '#0f172a',
    clusterBorder: '#334155',
    titleColor: '#f1f5f9',
    edgeLabelBackground: '#1e293b',
    actorBkg: '#1e3a5f',
    actorBorder: '#3b82f6',
    actorTextColor: '#e2e8f0',
    actorLineColor: '#475569',
    signalColor: '#cbd5e1',
    signalTextColor: '#e2e8f0',
    labelBoxBkgColor: '#3f2a0a',
    labelBoxBorderColor: '#f59e0b',
    labelTextColor: '#fde68a',
    loopTextColor: '#e2e8f0',
    noteBkgColor: '#451a03',
    noteTextColor: '#fde68a',
    noteBorderColor: '#f59e0b',
    activationBkgColor: '#1e3a5f',
    activationBorderColor: '#3b82f6',
    altBackground: '#1e293b',
    classText: '#e2e8f0',
    pie1: '#60a5fa', pie2: '#34d399', pie3: '#fbbf24', pie4: '#f472b6',
    pie5: '#a78bfa', pie6: '#22d3ee', pie7: '#fb7185', pie8: '#a3e635',
    pie9: '#38bdf8', pie10: '#facc15', pie11: '#c084fc', pie12: '#2dd4bf',
    pieTitleTextColor: '#f1f5f9',
    pieSectionTextColor: '#0f172a',
    pieLegendTextColor: '#cbd5e1',
    pieStrokeColor: '#0f172a',
    pieOuterStrokeColor: '#475569',
    pieOpacity: '0.95',
    sectionBkgColor: '#1e3a5f',
    altSectionBkgColor: '#3f2a0a',
    gridColor: '#334155',
    todayLineColor: '#ef4444',
    taskBkgColor: '#3b82f6',
    taskTextColor: '#ffffff',
    taskTextDarkColor: '#0f172a',
    taskTextOutsideColor: '#e2e8f0',
    taskTextLightColor: '#ffffff',
    taskTextClickableColor: '#ffffff',
    doneTaskBkgColor: '#475569',
    doneTaskBorderColor: '#94a3b8',
    activeTaskBkgColor: '#3b82f6',
    activeTaskBorderColor: '#60a5fa',
    critBorderColor: '#f87171',
    critBkgColor: '#7f1d1d',
    git0: '#60a5fa', git1: '#34d399', git2: '#fbbf24', git3: '#f472b6',
    git4: '#a78bfa', git5: '#22d3ee', git6: '#fb7185', git7: '#a3e635',
    gitBranchLabel0: '#0f172a', gitBranchLabel1: '#0f172a', gitBranchLabel2: '#0f172a',
    gitBranchLabel3: '#0f172a', gitBranchLabel4: '#0f172a', gitBranchLabel5: '#0f172a',
    gitBranchLabel6: '#0f172a', gitBranchLabel7: '#0f172a'
};

// =========================================================================
// Mermaid 风格预设（在设置面板中可选）
// 每个风格提供 light/dark 两套 themeVariables、look、flowchart 控制参数
// =========================================================================
var MERMAID_STYLE_PRESETS = {
    // 经典蓝 - 项目默认
    classic: {
        look: 'classic',
        flowchart: { curve: 'basis' },
        light: MERMAID_LIGHT_VARS,
        dark: MERMAID_DARK_VARS
    },
    // Neo 现代 - beautiful-mermaid Mono Mode 风（bg/fg 两色派生）
    neo: {
        look: 'neo',
        flowchart: { curve: 'linear' },
        light: {
            fontFamily: MERMAID_FONT_NOTION, fontSize: '14px', background: 'transparent',
            primaryColor: '#ffffff', primaryTextColor: '#262626', primaryBorderColor: '#737373',
            secondaryColor: '#ffffff', secondaryTextColor: '#404040', secondaryBorderColor: '#b8b8b8',
            tertiaryColor: '#fafafa', tertiaryTextColor: '#525252', tertiaryBorderColor: '#dcdcdc',
            lineColor: '#a3a3a3',
            mainBkg: '#ffffff', secondBkg: '#ffffff', tertiaryBkg: '#fafafa',
            nodeBorder: '#737373', nodeTextColor: '#262626',
            clusterBkg: '#ffffff', clusterBorder: '#ececec',
            titleColor: '#262626', edgeLabelBackground: '#ffffff',
            actorBkg: '#ffffff', actorBorder: '#737373', actorTextColor: '#262626',
            actorLineColor: '#dcdcdc', signalColor: '#737373', signalTextColor: '#262626',
            labelBoxBkgColor: '#ffffff', labelBoxBorderColor: '#b8b8b8', labelTextColor: '#404040',
            noteBkgColor: '#ffffff', noteTextColor: '#404040', noteBorderColor: '#dcdcdc',
            altBackground: '#ffffff', classText: '#262626',
            pie1: '#737373', pie2: '#8e8e8e', pie3: '#525252', pie4: '#a3a3a3',
            pie5: '#404040', pie6: '#d4d4d4', pie7: '#262626', pie8: '#e5e5e5',
            pie9: '#5c5c5c', pie10: '#7a7a7a', pie11: '#9c9c9c', pie12: '#bdbdbd',
            pieTitleTextColor: '#262626', pieSectionTextColor: '#ffffff',
            pieLegendTextColor: '#525252', pieStrokeColor: '#ffffff', pieOuterStrokeColor: '#737373',
            sectionBkgColor: '#ffffff', altSectionBkgColor: '#fafafa', gridColor: '#ececec',
            taskBkgColor: '#737373', taskTextColor: '#ffffff',
            taskTextDarkColor: '#262626', taskTextOutsideColor: '#262626',
            git0: '#737373', git1: '#525252', git2: '#8e8e8e', git3: '#b0b0b0',
            git4: '#404040', git5: '#9c9c9c', git6: '#d4d4d4', git7: '#262626'
        },
        dark: {
            fontFamily: MERMAID_FONT_NOTION, fontSize: '14px', darkMode: true, background: 'transparent',
            primaryColor: '#0a0a0a', primaryTextColor: '#fafafa', primaryBorderColor: '#fafafa',
            secondaryColor: '#171717', secondaryTextColor: '#e5e5e5', secondaryBorderColor: '#a3a3a3',
            tertiaryColor: '#262626', tertiaryTextColor: '#d4d4d4', tertiaryBorderColor: '#737373',
            lineColor: '#737373',
            mainBkg: '#0a0a0a', secondBkg: '#171717', tertiaryBkg: '#262626',
            nodeBorder: '#fafafa', nodeTextColor: '#fafafa',
            clusterBkg: '#171717', clusterBorder: '#404040',
            titleColor: '#fafafa', edgeLabelBackground: '#0a0a0a',
            actorBkg: '#0a0a0a', actorBorder: '#fafafa', actorTextColor: '#fafafa',
            actorLineColor: '#525252', signalColor: '#e5e5e5', signalTextColor: '#fafafa',
            labelBoxBkgColor: '#171717', labelBoxBorderColor: '#a3a3a3', labelTextColor: '#e5e5e5',
            noteBkgColor: '#171717', noteTextColor: '#e5e5e5', noteBorderColor: '#525252',
            altBackground: '#171717', classText: '#fafafa',
            pie1: '#fafafa', pie2: '#e5e5e5', pie3: '#d4d4d4', pie4: '#a3a3a3',
            pie5: '#737373', pie6: '#525252', pie7: '#404040', pie8: '#262626',
            pie9: '#f5f5f5', pie10: '#d6d3d1', pie11: '#a8a29e', pie12: '#57534e',
            pieTitleTextColor: '#fafafa', pieSectionTextColor: '#0a0a0a',
            pieLegendTextColor: '#d4d4d4', pieStrokeColor: '#0a0a0a', pieOuterStrokeColor: '#fafafa',
            sectionBkgColor: '#171717', altSectionBkgColor: '#262626', gridColor: '#404040',
            taskBkgColor: '#fafafa', taskTextColor: '#0a0a0a',
            taskTextDarkColor: '#fafafa', taskTextOutsideColor: '#fafafa',
            git0: '#fafafa', git1: '#d4d4d4', git2: '#a3a3a3', git3: '#737373',
            git4: '#e5e5e5', git5: '#525252', git6: '#404040', git7: '#262626'
        }
    },
    // 手绘草图 - Excalidraw 风格（Open Colors 调色板，奶白底+墨黑文字+多色相节点）
    sketch: {
        look: 'handDrawn',
        flowchart: { curve: 'basis' },
        light: {
            fontFamily: MERMAID_FONT_HANDDRAWN, fontSize: '15px', background: 'transparent',
            // 节点底色用 Open Colors 第 0 级（最浅，避免 hatch 斜纯加深）、描边用第 7 级、文字一律近纯黑 #0a0a0a
            primaryColor: '#e7f5ff', primaryTextColor: '#0a0a0a', primaryBorderColor: '#1c7ed6',
            secondaryColor: '#e3fafc', secondaryTextColor: '#0a0a0a', secondaryBorderColor: '#1098ad',
            tertiaryColor: '#edf2ff', tertiaryTextColor: '#0a0a0a', tertiaryBorderColor: '#4263eb',
            lineColor: '#343a40',
            mainBkg: '#e7f5ff', secondBkg: '#e3fafc', tertiaryBkg: '#edf2ff',
            nodeBorder: '#1c7ed6', nodeTextColor: '#0a0a0a',
            clusterBkg: '#fdfcf7', clusterBorder: '#adb5bd',
            titleColor: '#0a0a0a', edgeLabelBackground: '#fdfcf7',
            actorBkg: '#e7f5ff', actorBorder: '#1c7ed6', actorTextColor: '#0a0a0a',
            actorLineColor: '#495057', signalColor: '#0a0a0a', signalTextColor: '#0a0a0a',
            labelBoxBkgColor: '#fff9db', labelBoxBorderColor: '#f59f00', labelTextColor: '#0a0a0a',
            noteBkgColor: '#fff9db', noteTextColor: '#0a0a0a', noteBorderColor: '#fab005',
            altBackground: '#fdfcf7', classText: '#0a0a0a',
            // 饼图：Open Colors 多色相中等饱和度
            pie1: '#4dabf7', pie2: '#3bc9db', pie3: '#5c7cfa', pie4: '#38d9a9',
            pie5: '#ffd43b', pie6: '#ff922b', pie7: '#ff6b6b', pie8: '#cc5de8',
            pie9: '#a9e34b', pie10: '#74c0fc', pie11: '#ff8787', pie12: '#9775fa',
            pieTitleTextColor: '#0a0a0a', pieSectionTextColor: '#0a0a0a',
            pieLegendTextColor: '#343a40', pieStrokeColor: '#fdfcf7', pieOuterStrokeColor: '#495057',
            sectionBkgColor: '#e7f5ff', altSectionBkgColor: '#e3fafc', gridColor: '#dee2e6',
            taskBkgColor: '#1c7ed6', taskTextColor: '#fdfcf7',
            git0: '#1c7ed6', git1: '#1098ad', git2: '#4263eb', git3: '#0ca678',
            git4: '#339af0', git5: '#22b8cf', git6: '#5c7cfa', git7: '#12b886',
            shapeColors: {
                rect:      { fill: '#e7f5ff', stroke: '#1c7ed6', text: '#0a0a0a' }, // blue-0
                rounded:   { fill: '#e6fcf5', stroke: '#0ca678', text: '#0a0a0a' }, // teal-0
                diamond:   { fill: '#f3f0ff', stroke: '#7048e8', text: '#0a0a0a' }, // violet-0
                hexagon:   { fill: '#e3fafc', stroke: '#1098ad', text: '#0a0a0a' }, // cyan-0
                cylinder:  { fill: '#edf2ff', stroke: '#4263eb', text: '#0a0a0a' }, // indigo-0
                circle:    { fill: '#fff9db', stroke: '#f59f00', text: '#0a0a0a' }, // yellow-0
                ellipse:   { fill: '#fff5f5', stroke: '#fa5252', text: '#0a0a0a' }  // red-0
            }
        },
        dark: {
            fontFamily: MERMAID_FONT_HANDDRAWN, fontSize: '15px', darkMode: true, background: 'transparent',
            // 深色：节点用中性深底，文字一律 gray-0 近白
            primaryColor: '#1971c2', primaryTextColor: '#f8f9fa', primaryBorderColor: '#74c0fc',
            secondaryColor: '#0c8599', secondaryTextColor: '#f8f9fa', secondaryBorderColor: '#66d9e8',
            tertiaryColor: '#3b5bdb', tertiaryTextColor: '#f8f9fa', tertiaryBorderColor: '#91a7ff',
            lineColor: '#adb5bd',
            mainBkg: '#1971c2', secondBkg: '#0c8599', tertiaryBkg: '#3b5bdb',
            nodeBorder: '#74c0fc', nodeTextColor: '#f8f9fa',
            clusterBkg: '#212529', clusterBorder: '#495057',
            titleColor: '#f8f9fa', edgeLabelBackground: '#212529',
            actorBkg: '#1971c2', actorBorder: '#74c0fc', actorTextColor: '#f8f9fa',
            actorLineColor: '#868e96', signalColor: '#dee2e6', signalTextColor: '#f8f9fa',
            labelBoxBkgColor: '#5c3c00', labelBoxBorderColor: '#fab005', labelTextColor: '#fff3bf',
            noteBkgColor: '#3d2e00', noteTextColor: '#fff3bf', noteBorderColor: '#fab005',
            altBackground: '#212529', classText: '#f8f9fa',
            pie1: '#74c0fc', pie2: '#66d9e8', pie3: '#91a7ff', pie4: '#63e6be',
            pie5: '#ffd43b', pie6: '#ffa94d', pie7: '#ff8787', pie8: '#da77f2',
            pie9: '#c0eb75', pie10: '#a5d8ff', pie11: '#ffc9c9', pie12: '#b197fc',
            pieTitleTextColor: '#f8f9fa', pieSectionTextColor: '#212529',
            pieLegendTextColor: '#dee2e6', pieStrokeColor: '#212529', pieOuterStrokeColor: '#74c0fc',
            sectionBkgColor: '#1971c2', altSectionBkgColor: '#0c8599', gridColor: '#495057',
            taskBkgColor: '#74c0fc', taskTextColor: '#212529',
            git0: '#74c0fc', git1: '#66d9e8', git2: '#91a7ff', git3: '#63e6be',
            git4: '#a5d8ff', git5: '#3bc9db', git6: '#748ffc', git7: '#38d9a9',
            shapeColors: {
                rect:      { fill: '#1971c2', stroke: '#74c0fc', text: '#f8f9fa' },
                rounded:   { fill: '#087f5b', stroke: '#63e6be', text: '#f8f9fa' },
                diamond:   { fill: '#5f3dc4', stroke: '#b197fc', text: '#f8f9fa' },
                hexagon:   { fill: '#0c8599', stroke: '#66d9e8', text: '#f8f9fa' },
                cylinder:  { fill: '#3b5bdb', stroke: '#91a7ff', text: '#f8f9fa' },
                circle:    { fill: '#e67700', stroke: '#ffd43b', text: '#f8f9fa' },
                ellipse:   { fill: '#c92a2a', stroke: '#ff8787', text: '#f8f9fa' }
            }
        }
    },
    // 森林绿 - 自然清新
    forest: {
        look: 'classic',
        flowchart: { curve: 'basis' },
        light: {
            fontFamily: MERMAID_FONT_DEFAULT, fontSize: '14px', background: 'transparent',
            primaryColor: '#f0fdf4', primaryTextColor: '#14532d', primaryBorderColor: '#15803d',
            secondaryColor: '#fefce8', secondaryTextColor: '#713f12', secondaryBorderColor: '#ca8a04',
            tertiaryColor: '#ecfeff', tertiaryTextColor: '#155e75', tertiaryBorderColor: '#0e7490',
            lineColor: '#86efac',
            mainBkg: '#f0fdf4', secondBkg: '#fefce8', tertiaryBkg: '#ecfeff',
            nodeBorder: '#15803d', nodeTextColor: '#14532d',
            clusterBkg: '#fafffb', clusterBorder: '#bbf7d0',
            titleColor: '#14532d', edgeLabelBackground: '#ffffff',
            actorBkg: '#f0fdf4', actorBorder: '#15803d', actorTextColor: '#14532d',
            actorLineColor: '#bbf7d0', signalColor: '#365314', signalTextColor: '#14532d',
            labelBoxBkgColor: '#fefce8', labelBoxBorderColor: '#ca8a04', labelTextColor: '#713f12',
            noteBkgColor: '#fefce8', noteTextColor: '#713f12', noteBorderColor: '#fde68a',
            altBackground: '#fafffb', classText: '#14532d',
            pie1: '#16a34a', pie2: '#65a30d', pie3: '#0d9488', pie4: '#ca8a04',
            pie5: '#0891b2', pie6: '#a16207', pie7: '#84cc16', pie8: '#059669',
            pie9: '#22c55e', pie10: '#eab308', pie11: '#14b8a6', pie12: '#10b981',
            pieTitleTextColor: '#14532d', pieSectionTextColor: '#ffffff',
            pieLegendTextColor: '#365314', pieStrokeColor: '#ffffff', pieOuterStrokeColor: '#bbf7d0',
            sectionBkgColor: '#f0fdf4', altSectionBkgColor: '#fefce8', gridColor: '#dcfce7',
            taskBkgColor: '#16a34a', taskTextColor: '#ffffff',
            git0: '#16a34a', git1: '#65a30d', git2: '#0d9488', git3: '#ca8a04',
            git4: '#0891b2', git5: '#a16207', git6: '#84cc16', git7: '#059669'
        },
        dark: {
            fontFamily: MERMAID_FONT_DEFAULT, fontSize: '14px', darkMode: true, background: 'transparent',
            primaryColor: '#14352a', primaryTextColor: '#bbf7d0', primaryBorderColor: '#22c55e',
            secondaryColor: '#3f2e0a', secondaryTextColor: '#fef3c7', secondaryBorderColor: '#eab308',
            tertiaryColor: '#0e3a3f', tertiaryTextColor: '#a5f3fc', tertiaryBorderColor: '#06b6d4',
            lineColor: '#86efac',
            mainBkg: '#14352a', secondBkg: '#3f2e0a', tertiaryBkg: '#0e3a3f',
            nodeBorder: '#22c55e', nodeTextColor: '#bbf7d0',
            clusterBkg: '#052e16', clusterBorder: '#15803d',
            titleColor: '#bbf7d0', edgeLabelBackground: '#052e16',
            actorBkg: '#14352a', actorBorder: '#22c55e', actorTextColor: '#bbf7d0',
            actorLineColor: '#365314', signalColor: '#dcfce7', signalTextColor: '#bbf7d0',
            labelBoxBkgColor: '#3f2e0a', labelBoxBorderColor: '#eab308', labelTextColor: '#fef3c7',
            noteBkgColor: '#3f2e0a', noteTextColor: '#fef3c7', noteBorderColor: '#facc15',
            altBackground: '#14352a', classText: '#bbf7d0',
            pie1: '#4ade80', pie2: '#a3e635', pie3: '#2dd4bf', pie4: '#facc15',
            pie5: '#22d3ee', pie6: '#fbbf24', pie7: '#84cc16', pie8: '#10b981',
            pie9: '#34d399', pie10: '#eab308', pie11: '#5eead4', pie12: '#86efac',
            pieTitleTextColor: '#bbf7d0', pieSectionTextColor: '#052e16',
            pieLegendTextColor: '#86efac', pieStrokeColor: '#052e16', pieOuterStrokeColor: '#22c55e',
            sectionBkgColor: '#14352a', altSectionBkgColor: '#3f2e0a', gridColor: '#365314',
            taskBkgColor: '#22c55e', taskTextColor: '#052e16',
            git0: '#4ade80', git1: '#a3e635', git2: '#2dd4bf', git3: '#facc15',
            git4: '#22d3ee', git5: '#fbbf24', git6: '#84cc16', git7: '#10b981'
        }
    },
    // 扁平图标风 - 白底 + 彩色语义节点 (fireworks-tech-graph Flat Icon)
    flat: {
        look: 'classic',
        flowchart: { curve: 'basis' },
        light: {
            fontFamily: MERMAID_FONT_DEFAULT, fontSize: '14px', background: 'transparent',
            primaryColor: '#dbeafe', primaryTextColor: '#1e40af', primaryBorderColor: '#2563eb',
            secondaryColor: '#fed7aa', secondaryTextColor: '#9a3412', secondaryBorderColor: '#f97316',
            tertiaryColor: '#bbf7d0', tertiaryTextColor: '#166534', tertiaryBorderColor: '#22c55e',
            lineColor: '#64748b',
            mainBkg: '#dbeafe', secondBkg: '#fed7aa', tertiaryBkg: '#bbf7d0',
            nodeBorder: '#2563eb', nodeTextColor: '#1e40af',
            clusterBkg: '#f9fafb', clusterBorder: '#cbd5e1',
            titleColor: '#0f172a', edgeLabelBackground: '#ffffff',
            actorBkg: '#dbeafe', actorBorder: '#2563eb', actorTextColor: '#1e40af',
            actorLineColor: '#94a3b8', signalColor: '#475569', signalTextColor: '#0f172a',
            labelBoxBkgColor: '#fed7aa', labelBoxBorderColor: '#f97316', labelTextColor: '#9a3412',
            noteBkgColor: '#fef3c7', noteTextColor: '#78350f', noteBorderColor: '#f59e0b',
            altBackground: '#f9fafb', classText: '#0f172a',
            pie1: '#2563eb', pie2: '#f97316', pie3: '#22c55e', pie4: '#a855f7',
            pie5: '#ec4899', pie6: '#06b6d4', pie7: '#eab308', pie8: '#ef4444',
            pie9: '#3b82f6', pie10: '#fb923c', pie11: '#10b981', pie12: '#8b5cf6',
            pieTitleTextColor: '#0f172a', pieSectionTextColor: '#ffffff',
            pieLegendTextColor: '#475569', pieStrokeColor: '#ffffff', pieOuterStrokeColor: '#cbd5e1',
            sectionBkgColor: '#dbeafe', altSectionBkgColor: '#fed7aa', gridColor: '#e5e7eb',
            taskBkgColor: '#2563eb', taskTextColor: '#ffffff',
            git0: '#2563eb', git1: '#f97316', git2: '#22c55e', git3: '#a855f7',
            git4: '#ec4899', git5: '#06b6d4', git6: '#eab308', git7: '#ef4444',
            shapeColors: {
                rect:      { fill: '#dbeafe', stroke: '#2563eb', text: '#1e40af' },
                rounded:   { fill: '#bbf7d0', stroke: '#22c55e', text: '#166534' },
                diamond:   { fill: '#fed7aa', stroke: '#f97316', text: '#9a3412' },
                hexagon:   { fill: '#e9d5ff', stroke: '#a855f7', text: '#6b21a8' },
                cylinder:  { fill: '#cffafe', stroke: '#06b6d4', text: '#155e75' },
                circle:    { fill: '#dbeafe', stroke: '#2563eb', text: '#1e40af' },
                ellipse:   { fill: '#bbf7d0', stroke: '#22c55e', text: '#166534' }
            }
        },
        dark: {
            fontFamily: MERMAID_FONT_DEFAULT, fontSize: '14px', darkMode: true, background: 'transparent',
            primaryColor: '#1e3a8a', primaryTextColor: '#dbeafe', primaryBorderColor: '#60a5fa',
            secondaryColor: '#7c2d12', secondaryTextColor: '#fed7aa', secondaryBorderColor: '#fb923c',
            tertiaryColor: '#14532d', tertiaryTextColor: '#bbf7d0', tertiaryBorderColor: '#4ade80',
            lineColor: '#94a3b8',
            mainBkg: '#1e3a8a', secondBkg: '#7c2d12', tertiaryBkg: '#14532d',
            nodeBorder: '#60a5fa', nodeTextColor: '#dbeafe',
            clusterBkg: '#0f172a', clusterBorder: '#475569',
            titleColor: '#f1f5f9', edgeLabelBackground: '#0f172a',
            actorBkg: '#1e3a8a', actorBorder: '#60a5fa', actorTextColor: '#dbeafe',
            actorLineColor: '#475569', signalColor: '#cbd5e1', signalTextColor: '#f1f5f9',
            labelBoxBkgColor: '#7c2d12', labelBoxBorderColor: '#fb923c', labelTextColor: '#fed7aa',
            noteBkgColor: '#451a03', noteTextColor: '#fde68a', noteBorderColor: '#f59e0b',
            altBackground: '#0f172a', classText: '#f1f5f9',
            pie1: '#60a5fa', pie2: '#fb923c', pie3: '#4ade80', pie4: '#c084fc',
            pie5: '#f472b6', pie6: '#22d3ee', pie7: '#facc15', pie8: '#f87171',
            pie9: '#93c5fd', pie10: '#fdba74', pie11: '#34d399', pie12: '#a78bfa',
            pieTitleTextColor: '#f1f5f9', pieSectionTextColor: '#0f172a',
            pieLegendTextColor: '#cbd5e1', pieStrokeColor: '#0f172a', pieOuterStrokeColor: '#475569',
            sectionBkgColor: '#1e3a8a', altSectionBkgColor: '#7c2d12', gridColor: '#334155',
            taskBkgColor: '#60a5fa', taskTextColor: '#0f172a',
            git0: '#60a5fa', git1: '#fb923c', git2: '#4ade80', git3: '#c084fc',
            git4: '#f472b6', git5: '#22d3ee', git6: '#facc15', git7: '#f87171',
            shapeColors: {
                rect:      { fill: '#1e3a8a', stroke: '#60a5fa', text: '#dbeafe' },
                rounded:   { fill: '#14532d', stroke: '#4ade80', text: '#bbf7d0' },
                diamond:   { fill: '#7c2d12', stroke: '#fb923c', text: '#fed7aa' },
                hexagon:   { fill: '#4c1d95', stroke: '#c084fc', text: '#e9d5ff' },
                cylinder:  { fill: '#164e63', stroke: '#22d3ee', text: '#cffafe' },
                circle:    { fill: '#1e3a8a', stroke: '#60a5fa', text: '#dbeafe' },
                ellipse:   { fill: '#14532d', stroke: '#4ade80', text: '#bbf7d0' }
            }
        }
    },
    // Notion 极简风 - 白底 + 浅灰边框 + Notion 蓝单一强调色 (fireworks-tech-graph Notion Clean)
    notion: {
        look: 'classic',
        flowchart: { curve: 'basis' },
        light: {
            fontFamily: MERMAID_FONT_NOTION, fontSize: '14px', background: 'transparent',
            primaryColor: '#ffffff', primaryTextColor: '#37352f', primaryBorderColor: '#d3d1cb',
            secondaryColor: '#fcfbf9', secondaryTextColor: '#37352f', secondaryBorderColor: '#b8b4ab',
            tertiaryColor: '#f4faff', tertiaryTextColor: '#1f5482', tertiaryBorderColor: '#2383e2',
            lineColor: '#9b9a97',
            mainBkg: '#ffffff', secondBkg: '#fcfbf9', tertiaryBkg: '#f4faff',
            nodeBorder: '#d3d1cb', nodeTextColor: '#37352f',
            clusterBkg: '#ffffff', clusterBorder: '#e9e9e7',
            titleColor: '#37352f', edgeLabelBackground: '#ffffff',
            actorBkg: '#ffffff', actorBorder: '#d3d1cb', actorTextColor: '#37352f',
            actorLineColor: '#d3d1cb', signalColor: '#787774', signalTextColor: '#37352f',
            labelBoxBkgColor: '#fcfbf9', labelBoxBorderColor: '#b8b4ab', labelTextColor: '#37352f',
            noteBkgColor: '#fdf9ec', noteTextColor: '#65492b', noteBorderColor: '#e6cfa1',
            altBackground: '#fcfbf9', classText: '#37352f',
            pie1: '#2383e2', pie2: '#787774', pie3: '#d9b884', pie4: '#9b9a97',
            pie5: '#37352f', pie6: '#a39bca', pie7: '#cb912f', pie8: '#5b97bd',
            pie9: '#aab59f', pie10: '#c4a3a3', pie11: '#6f6e69', pie12: '#dabbb1',
            pieTitleTextColor: '#37352f', pieSectionTextColor: '#ffffff',
            pieLegendTextColor: '#787774', pieStrokeColor: '#ffffff', pieOuterStrokeColor: '#d3d1cb',
            sectionBkgColor: '#fcfbf9', altSectionBkgColor: '#ffffff', gridColor: '#e9e9e7',
            taskBkgColor: '#2383e2', taskTextColor: '#ffffff',
            git0: '#2383e2', git1: '#787774', git2: '#d9b884', git3: '#a39bca',
            git4: '#cb912f', git5: '#5b97bd', git6: '#aab59f', git7: '#c4a3a3'
        },
        dark: {
            fontFamily: MERMAID_FONT_NOTION, fontSize: '14px', darkMode: true, background: 'transparent',
            primaryColor: '#2f3437', primaryTextColor: '#ebeae8', primaryBorderColor: '#454b4e',
            secondaryColor: '#373c3f', secondaryTextColor: '#ebeae8', secondaryBorderColor: '#4f5559',
            tertiaryColor: '#1c3144', tertiaryTextColor: '#a4d4f5', tertiaryBorderColor: '#529cca',
            lineColor: '#6e7173',
            mainBkg: '#2f3437', secondBkg: '#373c3f', tertiaryBkg: '#1c3144',
            nodeBorder: '#454b4e', nodeTextColor: '#ebeae8',
            clusterBkg: '#25292c', clusterBorder: '#454b4e',
            titleColor: '#ebeae8', edgeLabelBackground: '#25292c',
            actorBkg: '#2f3437', actorBorder: '#454b4e', actorTextColor: '#ebeae8',
            actorLineColor: '#4f5559', signalColor: '#bcb9b3', signalTextColor: '#ebeae8',
            labelBoxBkgColor: '#373c3f', labelBoxBorderColor: '#4f5559', labelTextColor: '#ebeae8',
            noteBkgColor: '#3a3328', noteTextColor: '#f3d9a4', noteBorderColor: '#a78c5b',
            altBackground: '#25292c', classText: '#ebeae8',
            pie1: '#529cca', pie2: '#bcb9b3', pie3: '#d9b884', pie4: '#a39bca',
            pie5: '#ebeae8', pie6: '#9bd1e5', pie7: '#e8b86e', pie8: '#7fb1d4',
            pie9: '#b9c4ac', pie10: '#d4a8a8', pie11: '#9fa19c', pie12: '#deccc4',
            pieTitleTextColor: '#ebeae8', pieSectionTextColor: '#25292c',
            pieLegendTextColor: '#bcb9b3', pieStrokeColor: '#25292c', pieOuterStrokeColor: '#454b4e',
            sectionBkgColor: '#2f3437', altSectionBkgColor: '#373c3f', gridColor: '#454b4e',
            taskBkgColor: '#529cca', taskTextColor: '#25292c',
            git0: '#529cca', git1: '#bcb9b3', git2: '#d9b884', git3: '#a39bca',
            git4: '#e8b86e', git5: '#7fb1d4', git6: '#b9c4ac', git7: '#d4a8a8'
        }
    }
};

var MERMAID_STYLE_DEFAULT = 'classic';
var MERMAID_STYLE_KEY = 'mermaidStyle';

function getCurrentMermaidStyle() {
    try {
        var saved = localStorage.getItem(MERMAID_STYLE_KEY);
        if (saved && MERMAID_STYLE_PRESETS[saved]) return saved;
    } catch (e) {}
    return MERMAID_STYLE_DEFAULT;
}

// 检测 SVG 节点中 Mermaid 渲染的形状类型
function detectNodeShape(nodeGroup) {
    var shape = nodeGroup.querySelector('rect, circle, ellipse, polygon, path');
    if (!shape) return 'rect';
    var tag = shape.tagName.toLowerCase();
    if (tag === 'circle') return 'circle';
    if (tag === 'ellipse') return 'ellipse';
    if (tag === 'path') return 'cylinder';
    if (tag === 'polygon') {
        var raw = (shape.getAttribute('points') || '').trim().split(/[\s,]+/).filter(Boolean);
        var numPts = raw.length / 2;
        if (numPts === 6) return 'hexagon';
        return 'diamond';  // 4 点菱形 或 平行四边形
    }
    if (tag === 'rect') {
        var rx = parseFloat(shape.getAttribute('rx')) || 0;
        return rx >= 5 ? 'rounded' : 'rect';
    }
    return 'rect';
}

// 从 Mermaid 源码解析节点 ID → 形状类型映射
// 用于 handDrawn 模式，因 rough.js 将所有形状统一渲染为 <path> 导致 detectNodeShape 失效
function parseMermaidNodeShapes(mermaidCode) {
    var map = {};
    // 支持 A, B1, node-2, Start 等含短横线的节点 ID
    var regex = /([\w-]+)(\[\[.*?\]\]|\[\(.*?\)\]|\(\(.*?\)\)|\{\{.*?\}\}|\[.*?\]|\(.*?\)|\{.*?\})/g;
    var match;
    while ((match = regex.exec(mermaidCode)) !== null) {
        var id = match[1];
        // 过滤箭头（--> ===> --o --x 等）
        if (/^[-=>ox]+$/.test(id)) continue;
        var brackets = match[2];
        if (brackets.indexOf('[[') === 0)      map[id] = 'rect';
        else if (brackets.indexOf('[(') === 0) map[id] = 'cylinder';
        else if (brackets.indexOf('((') === 0) map[id] = 'circle';
        else if (brackets.indexOf('{{') === 0) map[id] = 'hexagon';
        else if (brackets.indexOf('[') === 0)  map[id] = 'rect';
        else if (brackets.indexOf('(') === 0)  map[id] = 'rounded';
        else if (brackets.indexOf('{') === 0)  map[id] = 'diamond';
    }
    return map;
}

// 基于形状语义对 SVG 节点进行彩色映射（flat / sketch 风格生效）
function applyMermaidShapeColors(container) {
    var styleKey = getCurrentMermaidStyle();
    if (styleKey !== 'flat' && styleKey !== 'sketch') return;
    var preset = MERMAID_STYLE_PRESETS[styleKey];
    if (!preset) return;
    var isDark = document.body && document.body.classList.contains('dark-mode');
    var themeVars = isDark ? preset.dark : preset.light;
    var shapeColors = themeVars.shapeColors;
    if (!shapeColors) return;

    var svg = container.querySelector('svg');
    if (!svg) return;

    // sketch 风格从源码解析形状（handDrawn 下 rough.js 将全部节点渲染为 <path>）
    var nodeShapeMap = null;
    if (styleKey === 'sketch') {
        var mermaidCode = container.getAttribute('data-mermaid-source') || '';
        if (mermaidCode) {
            var parsed = parseMermaidNodeShapes(mermaidCode);
            // 仅当解析到有效映射时才启用源码路径，否则退回 SVG 检测
            for (var _k in parsed) { if (parsed.hasOwnProperty(_k)) { nodeShapeMap = parsed; break; } }
        }
    }

    // 优先用 g.node；handDrawn 模式下若拿不到，则基于 id 进行包含匹配
    // 实际 id 形如 mermaid-diagram-XXXX-N-flowchart-Z34-0 或 mermaid-diagram-XXXX-N-classId-Foo-0
    // 为了能统一提取原始节点 ID，在迭代中用正则提取
    var nodeIdRegex = /-(?:flowchart|classId)-(.+?)-\d+$/;
    var nodes = svg.querySelectorAll('g.node');
    if (nodes.length === 0) {
        var picked = [];
        svg.querySelectorAll('g[id]').forEach(function (g) {
            if (nodeIdRegex.test(g.getAttribute('id') || '')) picked.push(g);
        });
        nodes = picked;
    }

    nodes.forEach(function (node) {
        // 跳过 cluster 内的 wrapper（cluster-label 等）
        if (node.closest('g.cluster') && node.querySelector('g.cluster-label')) return;

        var shapeType;
        if (nodeShapeMap) {
            var svgId = node.getAttribute('id') || '';
            var nodeId = '';
            var m = nodeIdRegex.exec(svgId);
            if (m) {
                nodeId = m[1];
            } else {
                // 兼容旧格式 flowchart-A-0
                nodeId = svgId.replace(/^(flowchart|class|state|er|gantt|pie|git|mindmap)-/, '').replace(/-\d+$/, '');
            }
            shapeType = nodeShapeMap[nodeId] || 'rect';
        } else {
            shapeType = detectNodeShape(node);
        }

        var color = shapeColors[shapeType] || shapeColors['rect'];
        if (!color) return;

        // 主填充形状：handDrawn 模式下 rough.js 用多条 path 叠加模拟手绘，需要给全部 path/rect/circle 都赋色
        var shapes = node.querySelectorAll('rect, circle, ellipse, polygon, path');
        shapes.forEach(function (s) {
            if (color.fill) s.style.setProperty('fill', color.fill, 'important');
            if (color.stroke) s.style.setProperty('stroke', color.stroke, 'important');
        });

        // 文本颜色：SVG <text> 和 foreignObject 内的文本
        // halo 色根据文字亮度智能选择：暗字配浅 halo / 亮字配深 halo，避免文字被描边吃掉
        if (color.text) {
            var textHaloColor;
            if (styleKey === 'sketch') {
                // 解析文字色亮度，决定 halo 色
                var hex = (color.text || '').replace('#', '');
                var r = parseInt(hex.substr(0, 2), 16) || 0;
                var g = parseInt(hex.substr(2, 2), 16) || 0;
                var b = parseInt(hex.substr(4, 2), 16) || 0;
                var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                // 暗文字 → 用节点底色作浅 halo（遮住 hatch 斜纯）；亮文字 → 用近黑作深 halo
                textHaloColor = luminance < 0.5
                    ? (color.fill || '#ffffff')
                    : 'rgba(0,0,0,0.55)';
            } else {
                textHaloColor = isDark ? '#0b0b0b' : '#ffffff';
            }
            node.querySelectorAll('text').forEach(function (t) {
                t.style.setProperty('fill', color.text, 'important');
                if (styleKey === 'sketch') {
                    // 完全不给 SVG <text> 加 stroke（会撑大文字占位，导致被节点边界截断）
                    // halo 效果完全交给 div 的 textShadow（不占位不影响布局）
                    t.style.setProperty('stroke', 'none', 'important');
                    t.style.setProperty('stroke-width', '0', 'important');
                    t.style.setProperty('paint-order', 'fill', 'important');
                    t.style.setProperty('font-weight', '600', 'important');
                }
            });
            node.querySelectorAll('foreignObject').forEach(function (fo) {
                // 让 textShadow 能超出 foreignObject 边界显示，不被裁切
                if (styleKey === 'sketch') {
                    fo.style.setProperty('overflow', 'visible', 'important');
                }
                var div = fo.querySelector('div');
                if (div) {
                    div.style.color = color.text;
                    if (styleKey === 'sketch') {
                        div.style.overflow = 'visible';
                        // 四周描边 + 加粗，保证在 hatch 斜纯背景上可读
                        // 暗字用奶白 halo / 亮字用近黑 halo——这是抵抗斜纯纹理的关键
                        div.style.textShadow =
                            '-1px -1px 0 ' + textHaloColor + ',' +
                            ' 1px -1px 0 ' + textHaloColor + ',' +
                            '-1px  1px 0 ' + textHaloColor + ',' +
                            ' 1px  1px 0 ' + textHaloColor + ',' +
                            ' 0   -1px 0 ' + textHaloColor + ',' +
                            ' 0    1px 0 ' + textHaloColor + ',' +
                            '-1px  0   0 ' + textHaloColor + ',' +
                            ' 1px  0   0 ' + textHaloColor + ',' +
                            ' 0    0 3px ' + textHaloColor;
                        div.style.fontWeight = '600';
                    }
                }
            });
        }
    });
}

function buildMermaidConfig() {
    var isDark = document.body && document.body.classList.contains('dark-mode');
    var styleKey = getCurrentMermaidStyle();
    var preset = MERMAID_STYLE_PRESETS[styleKey] || MERMAID_STYLE_PRESETS[MERMAID_STYLE_DEFAULT];
    var themeVars = isDark ? preset.dark : preset.light;
    // 剔除自定义键（如 shapeColors），避免传入 Mermaid themeVariables
    var themeVarsClean = {};
    for (var k in themeVars) {
        if (themeVars.hasOwnProperty(k) && k !== 'shapeColors') {
            themeVarsClean[k] = themeVars[k];
        }
    }
    var fontFamily = themeVarsClean.fontFamily || MERMAID_FONT_DEFAULT;
    var flowCurve = (preset.flowchart && preset.flowchart.curve) || 'basis';
    return {
        startOnLoad: false,
        theme: 'base',
        themeVariables: themeVarsClean,
        look: preset.look || 'classic',
        securityLevel: 'loose',
        suppressErrorRendering: false,
        fontFamily: fontFamily,
        logLevel: 'error',
        // 流程图
        flowchart: {
            useMaxWidth: true,
            // 关闭 htmlLabels：所有节点文本走 SVG <text>，矢量缩放永不糊
            // 代价：节点不再支持 HTML/Markdown 富文本，仅支持纯文本和 \n 换行
            htmlLabels: false,
            curve: flowCurve,
            padding: styleKey === 'sketch' ? 24 : 18,
            nodeSpacing: styleKey === 'sketch' ? 60 : 55,
            rankSpacing: styleKey === 'sketch' ? 65 : 60,
            diagramPadding: 12
        },
    // 时序图
        sequence: {
            useMaxWidth: true,
            showSequenceNumbers: false,
            actorFontSize: 14,
            actorFontWeight: 500,
            noteFontSize: 13,
            noteFontWeight: 400,
            messageFontSize: 13,
            messageFontWeight: 400,
            wrap: true,
            width: 160,
            boxMargin: 10,
            mirrorActors: true,
            htmlLabels: false
        },
        // 类图
        class: {
            useMaxWidth: true,
            fontSize: 14,
            // 走 SVG <text> 矢量渲染，缩放永不糊
            htmlLabels: false
        },
        // 状态图
        state: {
            useMaxWidth: true,
            fontSize: 14,
            htmlLabels: false
        },
        // ER图
        er: {
            useMaxWidth: true,
            fontSize: 14,
            htmlLabels: false
        },
        // 甘特图
        gantt: {
            useMaxWidth: true,
            titleTopMargin: 25,
            barHeight: 22,
            barGap: 6,
            topPadding: 50,
            leftPadding: 85,
            gridLineStartPadding: 35,
            fontSize: 13,
            numberSectionStyles: 4,
            htmlLabels: false
        },
        // 饼图
        pie: {
            useMaxWidth: true,
            textPosition: 0.7,
            htmlLabels: false
        },
        // 旅程图
        journey: {
            useMaxWidth: true,
            htmlLabels: false
        },
        // Git图
        gitGraph: {
            useMaxWidth: true,
            mainBranchName: 'main',
            showCommitLabel: true,
            htmlLabels: false
        },
        // 思维导图
        mindmap: {
            useMaxWidth: true,
            padding: 12,
            htmlLabels: false
        },
        // 时间线
        timeline: {
            useMaxWidth: true,
            padding: 12,
            htmlLabels: false
        },
        // 桑基图
        sankey: {
            useMaxWidth: true,
            htmlLabels: false
        },
        // XY图表
        xyChart: {
            useMaxWidth: true,
            htmlLabels: false
        },
        // 象限图
        quadrantChart: {
            useMaxWidth: true,
            htmlLabels: false
        },
        // 需求图
        requirement: {
            useMaxWidth: true,
            fontSize: 14,
            htmlLabels: false
        },
        // 块图
        block: {
            useMaxWidth: true,
            padding: 12,
            htmlLabels: false
        },
        // 数据包图
        packet: {
            useMaxWidth: true,
            padding: 12,
            htmlLabels: false
        },
        // 架构图
        architecture: {
            useMaxWidth: true,
            padding: 12,
            htmlLabels: false
        },
        // 看板
        kanban: {
            useMaxWidth: true,
            padding: 12,
            htmlLabels: false
        }
    };
}

// 全局 MERMAID_CONFIG，调用者可随时读取最新主题配置
var MERMAID_CONFIG = buildMermaidConfig();
window.MERMAID_CONFIG = MERMAID_CONFIG;
window.applyMermaidShapeColors = applyMermaidShapeColors;
window.buildMermaidConfig = buildMermaidConfig;

// 初始化Mermaid
function initializeMermaid() {
    if (window.mermaid) {
        try {
            mermaid.initialize(MERMAID_CONFIG);
            console.log('✅ Mermaid已初始化 (v' + (mermaid.version || '?') + ')');
        } catch (e) {
            console.warn('⚠️ Mermaid初始化失败:', e);
        }
    } else {
        console.warn('⚠️ Mermaid库尚未加载，等待加载...');
        // 如果Mermaid还没加载，等待一段时间后重试
        setTimeout(initializeMermaid, 500);
    }
}

// 添加代码块复制按钮
function addCodeCopyButtons() {
    const codeBlocks = previewContent.querySelectorAll('pre:not(.mermaid-source)');
    
    codeBlocks.forEach((block, index) => {
        // 检查是否已经有复制按钮
        if (block.querySelector('.code-copy-btn')) return;
        
        const button = document.createElement('button');
        button.className = 'code-copy-btn';
        button.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>';
        button.setAttribute('data-index', index);
        button.title = '复制代码';
        
        button.addEventListener('click', async () => {
            const code = block.querySelector('code');
            const text = code ? code.textContent : block.textContent;
            
            const success = await copyToClipboard(text);
            
            if (success) {
                button.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>';
                button.classList.add('copied');
                
                setTimeout(() => {
                    button.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>';
                    button.classList.remove('copied');
                }, 2000);
            } else {
                button.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M11.46.146A.5.5 0 0 0 11.107 0H4.893a.5.5 0 0 0-.353.146L.146 4.54A.5.5 0 0 0 0 4.893v6.214a.5.5 0 0 0 .146.353l4.394 4.394a.5.5 0 0 0 .353.146h6.214a.5.5 0 0 0 .353-.146l4.394-4.394a.5.5 0 0 0 .146-.353V4.893a.5.5 0 0 0-.146-.353L11.46.146zM8 4c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995A.905.905 0 0 1 8 4zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>';
                setTimeout(() => {
                    button.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>';
                }, 2000);
            }
        });
        
        block.style.position = 'relative';
        block.appendChild(button);
    });
}

// 添加数学公式复制按钮
function addMathCopyButtons() {
    const mathBlocks = previewContent.querySelectorAll('.math-block');
    
    mathBlocks.forEach((block, index) => {
        // 检查是否已经有复制按钮
        if (block.querySelector('.math-copy-btn')) return;
        
        const button = document.createElement('button');
        button.className = 'math-copy-btn';
        button.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>';
        button.setAttribute('data-index', index);
        button.title = '复制LaTeX代码';
        
        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            // 获取原始LaTeX代码（排除按钮的文本）
            const clone = block.cloneNode(true);
            const btnInClone = clone.querySelector('.math-copy-btn');
            if (btnInClone) {
                btnInClone.remove();
            }
            const latexCode = clone.textContent.trim();
            
            const success = await copyToClipboard(latexCode);
            
            if (success) {
                button.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>';
                button.classList.add('copied');
                
                setTimeout(() => {
                    button.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>';
                    button.classList.remove('copied');
                }, 2000);
            } else {
                button.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M11.46.146A.5.5 0 0 0 11.107 0H4.893a.5.5 0 0 0-.353.146L.146 4.54A.5.5 0 0 0 0 4.893v6.214a.5.5 0 0 0 .146.353l4.394 4.394a.5.5 0 0 0 .353.146h6.214a.5.5 0 0 0 .353-.146l4.394-4.394a.5.5 0 0 0 .146-.353V4.893a.5.5 0 0 0-.146-.353L11.46.146zM8 4c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995A.905.905 0 0 1 8 4zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>';
                setTimeout(() => {
                    button.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>';
                }, 2000);
            }
        });
        
        block.appendChild(button);
    });
}

// 渲染Mermaid图表
async function renderMermaidDiagrams() {
    if (!window.mermaid) {
        console.warn('⚠️ Mermaid库未加载，等待加载...');
        // 等待Mermaid加载
        await new Promise(resolve => {
            const checkMermaid = setInterval(() => {
                if (window.mermaid) {
                    clearInterval(checkMermaid);
                    console.log('✅ Mermaid库已加载');
                    resolve();
                }
            }, 100);
            // 超时保护
            setTimeout(() => {
                clearInterval(checkMermaid);
                resolve();
            }, 5000);
        });
        
        if (!window.mermaid) {
            console.error('❌ Mermaid库加载超时');
            return;
        }
    }
    
    // 查找所有Mermaid代码块
    const mermaidBlocks = previewContent.querySelectorAll('pre code.language-mermaid');
    
    if (mermaidBlocks.length === 0) {
        console.log('📝 没有找到Mermaid代码块');
        // 调试：显示所有代码块的class
        const allCodeBlocks = previewContent.querySelectorAll('pre code');
        console.log('📋 所有代码块的class:', 
            Array.from(allCodeBlocks).map(cb => cb.className || '(无class)'));
        return;
    }
    
    console.log(`🎨 找到 ${mermaidBlocks.length} 个Mermaid代码块`);
    
    // 确保Mermaid已初始化
    try {
        mermaid.initialize(MERMAID_CONFIG);
    } catch (err) {
        console.error('Mermaid初始化失败:', err);
    }
    
    for (let i = 0; i < mermaidBlocks.length; i++) {
        const codeBlock = mermaidBlocks[i];
        const pre = codeBlock.parentElement;
        // 使用 textContent 会自动解码 HTML 实体
        const mermaidCode = codeBlock.textContent.trim();
        
        console.log(`🔧 处理Mermaid图表 ${i + 1}:`, mermaidCode.substring(0, 50) + '...');
        console.log(`📝 完整代码:`, mermaidCode);
        
        // 创建容器
        const container = document.createElement('div');
        container.className = 'mermaid-container';
        container.setAttribute('data-index', i);
        // 保存原始代码到容器的 data 属性中
        container.setAttribute('data-mermaid-source', mermaidCode);
        
        // 创建Mermaid渲染区域
        const mermaidDiv = document.createElement('div');
        mermaidDiv.className = 'mermaid';
        mermaidDiv.textContent = mermaidCode;
        
        // 创建操作按钮容器
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'mermaid-actions';
        
        // 放大查看按钮
        const zoomBtn = document.createElement('button');
        zoomBtn.className = 'mermaid-btn';
        zoomBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM13 6.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z"/><path d="M10.344 11.742c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1 6.538 6.538 0 0 1-1.398 1.4z"/><path fill-rule="evenodd" d="M6.5 3a.5.5 0 0 1 .5.5V6h2.5a.5.5 0 0 1 0 1H7v2.5a.5.5 0 0 1-1 0V7H3.5a.5.5 0 0 1 0-1H6V3.5a.5.5 0 0 1 .5-.5z"/></svg>';
        zoomBtn.title = '放大查看';
        zoomBtn.addEventListener('click', () => openMermaidZoomModal(container));
        
        // 复制源代码按钮
        const copyBtn = document.createElement('button');
        copyBtn.className = 'mermaid-btn';
        copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>';
        copyBtn.title = '复制源代码';
        copyBtn.addEventListener('click', async () => {
            // 从容器的 data 属性中获取原始代码
            const sourceCode = container.getAttribute('data-mermaid-source') || mermaidCode;
            const success = await copyToClipboard(sourceCode);
            if (success) {
                copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>';
                copyBtn.classList.add('success');
                setTimeout(() => {
                    copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>';
                    copyBtn.classList.remove('success');
                }, 2000);
            }
        });
        
        // 导出为JPG按钮
        const exportBtn = document.createElement('button');
        exportBtn.className = 'mermaid-btn';
        exportBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>';
        exportBtn.title = '导出为JPG';
        exportBtn.addEventListener('click', () => exportMermaidAsImage(container, i));
        
        actionsDiv.appendChild(zoomBtn);
        actionsDiv.appendChild(copyBtn);
        actionsDiv.appendChild(exportBtn);
        
        container.appendChild(mermaidDiv);
        container.appendChild(actionsDiv);
        
        // 替换原来的代码块
        pre.parentNode.replaceChild(container, pre);
    }
    
    // 渲染所有Mermaid图表 - 使用手动渲染方式，更可控
    try {
        const containers = previewContent.querySelectorAll('.mermaid-container');
        console.log(`📌 准备渲染 ${containers.length} 个Mermaid图表`);
        
        for (let i = 0; i < containers.length; i++) {
            const container = containers[i];
            const mermaidDiv = container.querySelector('.mermaid');
            
            // 从容器的 data 属性中获取原始代码
            const graphDefinition = container.getAttribute('data-mermaid-source');
            
            if (!graphDefinition) {
                console.error(`❌ 图表 ${i + 1} 没有找到源代码`);
                continue;
            }
            
            const id = `mermaid-diagram-${Date.now()}-${i}`;
            
            console.log(`🎯 渲染图表 ${i + 1}, ID: ${id}`);
            console.log(`📄 图表定义 (前100字符):`, graphDefinition.substring(0, 100));
            
            try {
                // 使用 mermaid.render() 方法渲染
                const { svg } = await mermaid.render(id, graphDefinition);
                mermaidDiv.innerHTML = svg;
                applyMermaidShapeColors(container);
                console.log(`✅ 图表 ${i + 1} 渲染成功`);
            } catch (renderErr) {
                console.error(`❌ 图表 ${i + 1} 渲染失败:`, renderErr);
                console.error(`❌ 完整错误信息:`, {
                    message: renderErr.message,
                    name: renderErr.name,
                    stack: renderErr.stack
                });
                
                // 显示友好的错误信息
                mermaidDiv.innerHTML = `<div style="padding: 20px; background: #fee; border: 2px solid #f88; border-radius: 6px; color: #c33; font-family: monospace; max-width: 100%; overflow: auto;">
                    <strong style="font-size: 16px;">❌ Mermaid 图表渲染失败</strong><br><br>
                    <strong>错误信息：</strong><br>
                    <div style="background: #fff; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; color: #d00;">
                        ${escapeHtml(renderErr.message || '未知错误')}
                    </div>
                    <details style="margin-top: 10px;">
                        <summary style="cursor: pointer; font-weight: bold;">📝 查看图表源代码</summary>
                        <pre style="background: #fff; padding: 10px; margin-top: 10px; border: 1px solid #ddd; border-radius: 4px; overflow-x: auto; color: #333; white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(graphDefinition)}</pre>
                    </details>
                    <small style="display: block; margin-top: 10px; color: #666;">💡 提示：检查图表语法是否正确，或参考 <a href="https://mermaid.js.org/" target="_blank" style="color: #0066cc;">Mermaid 官方文档</a></small>
                </div>`;
            }
        }
        
        console.log('✅ Mermaid图表渲染完成');
    } catch (err) {
        console.error('❌ Mermaid渲染过程出错:', err);
    }
}

// 以可缩放/平移的模态框放大查看 Mermaid 图表
// 入参可以是预览区的 .mermaid-container 或 AI 聊天区的 .ai-mermaid-container
function openMermaidZoomModal(container) {
    if (!container) return;
    if (!container.querySelector('svg')) {
        alert('图表尚未渲染完成，请稍候再试');
        return;
    }

    // 收集同类型容器，用于左右切换（预览区与 AI 聊天区分别独立）
    const isAi = container.classList.contains('ai-mermaid-container');
    const siblingSelector = isAi ? '.ai-mermaid-container' : '.mermaid-container';
    const siblings = Array.from(document.querySelectorAll(siblingSelector))
        .filter(el => el.querySelector('svg'));
    let currentIndex = siblings.indexOf(container);
    if (currentIndex < 0) {
        siblings.unshift(container);
        currentIndex = 0;
    }

    // 若已存在则先关闭，避免叠加
    const existing = document.querySelector('.mermaid-zoom-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'mermaid-zoom-modal';
    modal.innerHTML = `
        <div class="mermaid-zoom-content" role="dialog" aria-label="Mermaid 图表放大查看">
            <div class="mermaid-zoom-toolbar">
                <span class="mermaid-zoom-title">Mermaid 图表查看 <span class="mermaid-zoom-counter"></span></span>
                <div class="mermaid-zoom-actions">
                    <button class="mermaid-zoom-btn" data-act="zoom-out" title="缩小 (-)">−</button>
                    <span class="mermaid-zoom-scale">100%</span>
                    <button class="mermaid-zoom-btn" data-act="zoom-in" title="放大 (+)">+</button>
                    <button class="mermaid-zoom-btn" data-act="fit" title="适应窗口 (0)">适应</button>
                    <button class="mermaid-zoom-btn" data-act="reset" title="实际大小 (1)">1:1</button>
                    <button class="mermaid-zoom-btn mermaid-zoom-close" data-act="close" title="关闭 (Esc)">✕</button>
                </div>
            </div>
            <div class="mermaid-zoom-viewport">
                <button type="button" class="mermaid-zoom-nav mermaid-zoom-prev" data-act="prev" title="上一张 (←)" aria-label="上一张">
                    <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/></svg>
                </button>
                <div class="mermaid-zoom-stage"></div>
                <button type="button" class="mermaid-zoom-nav mermaid-zoom-next" data-act="next" title="下一张 (→)" aria-label="下一张">
                    <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/></svg>
                </button>
            </div>
            <div class="mermaid-zoom-hint">滚轮缩放 · 拖动平移 · 双击适应 · ←/→ 切换 · Esc 关闭</div>
        </div>
    `;
    document.body.appendChild(modal);

    const viewport = modal.querySelector('.mermaid-zoom-viewport');
    const stage = modal.querySelector('.mermaid-zoom-stage');
    const scaleLabel = modal.querySelector('.mermaid-zoom-scale');
    const counterLabel = modal.querySelector('.mermaid-zoom-counter');
    const prevBtn = modal.querySelector('.mermaid-zoom-prev');
    const nextBtn = modal.querySelector('.mermaid-zoom-next');

    const MIN_SCALE = 0.1;
    const MAX_SCALE = 10;
    let baseW = 0, baseH = 0;
    let scale = 1, tx = 0, ty = 0;

    // 将 SVG 内的 foreignObject（HTML 内容）转换为原生 SVG <text>
    // 原因：Chromium 对 foreignObject 总是先栅格化为 bitmap 再缩放，放大会糊
    // 只作用于 modal 内的克隆 SVG，不影响预览区原图
    function rasterizeForeignObjectsToText(svgEl) {
        if (!svgEl) return;
        const fos = Array.from(svgEl.querySelectorAll('foreignObject'));
        if (!fos.length) return;
        const NS = 'http://www.w3.org/2000/svg';
        const svgRect = svgEl.getBoundingClientRect();
        if (!svgRect.width || !svgRect.height) return;
        // 屏幕像素 -> SVG viewBox 单位的换算比例
        const sx = baseW / svgRect.width;
        const sy = baseH / svgRect.height;

        fos.forEach(fo => {
            const foX = parseFloat(fo.getAttribute('x')) || 0;
            const foY = parseFloat(fo.getAttribute('y')) || 0;
            const foRect = fo.getBoundingClientRect();
            if (!foRect.width || !foRect.height) return;

            // 收集所有非空文本节点
            const walker = document.createTreeWalker(fo, NodeFilter.SHOW_TEXT, {
                acceptNode: n => (n.textContent && n.textContent.trim())
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT
            });
            const records = [];
            let n;
            while ((n = walker.nextNode())) {
                const range = document.createRange();
                range.selectNodeContents(n);
                // getClientRects() 对多行文本逐行返回 rect，避免合并
                const rects = Array.from(range.getClientRects()).filter(r => r.width && r.height);
                if (!rects.length) continue;
                const parent = n.parentElement;
                const cs = parent ? getComputedStyle(parent) : null;
                const fontSizePx = cs ? (parseFloat(cs.fontSize) || 14) : 14;
                const fontFamily = cs ? cs.fontFamily : 'sans-serif';
                const fontWeight = cs ? cs.fontWeight : 'normal';
                const fontStyle = cs ? cs.fontStyle : 'normal';
                const fill = cs ? cs.color : '#000';
                const textAlign = cs ? cs.textAlign : 'left';

                // 按顶部坐标粗划分行（同一行可能被拆成多个 rect）
                const lines = [];
                rects.forEach(r => {
                    const last = lines[lines.length - 1];
                    if (last && Math.abs(last.top - r.top) < fontSizePx * 0.5) {
                        last.right = Math.max(last.right, r.right);
                        last.left = Math.min(last.left, r.left);
                    } else {
                        lines.push({ top: r.top, left: r.left, right: r.right, bottom: r.bottom });
                    }
                });

                const fullText = n.textContent;
                // 多行时按比例切分文本（近似，可接受）
                const textChunks = lines.length === 1
                    ? [fullText]
                    : splitTextByLines(fullText, lines);

                lines.forEach((ln, i) => {
                    records.push({
                        text: textChunks[i] || '',
                        rx: (ln.left - foRect.left) * sx,
                        ry: (ln.top - foRect.top) * sy,
                        rw: (ln.right - ln.left) * sx,
                        rh: (ln.bottom - ln.top) * sy,
                        fontSize: fontSizePx * sx,
                        fontFamily,
                        fontWeight,
                        fontStyle,
                        fill,
                        textAlign
                    });
                });
            }

            if (!records.length) return;

            const g = document.createElementNS(NS, 'g');
            g.setAttribute('transform', `translate(${foX}, ${foY})`);
            g.setAttribute('class', 'mermaid-zoom-fo-text');
            records.forEach(r => {
                if (!r.text || !r.text.trim()) return;
                const t = document.createElementNS(NS, 'text');
                let anchor = 'start';
                let cx = r.rx;
                if (r.textAlign === 'center') {
                    anchor = 'middle';
                    cx = r.rx + r.rw / 2;
                } else if (r.textAlign === 'right' || r.textAlign === 'end') {
                    anchor = 'end';
                    cx = r.rx + r.rw;
                }
                t.setAttribute('x', cx);
                // 近似基线：字号 * 0.82 从顶部偏移
                t.setAttribute('y', r.ry + r.fontSize * 0.82);
                t.setAttribute('font-size', r.fontSize);
                t.setAttribute('font-family', r.fontFamily);
                t.setAttribute('font-weight', r.fontWeight);
                t.setAttribute('font-style', r.fontStyle);
                t.setAttribute('fill', r.fill);
                t.setAttribute('text-anchor', anchor);
                t.setAttribute('dominant-baseline', 'alphabetic');
                t.textContent = r.text;
                g.appendChild(t);
            });
            fo.parentNode.replaceChild(g, fo);
        });
    }

    function splitTextByLines(text, lines) {
        // 按每行宽度比例分配字符（带中文估计粗略，可接受）
        const total = lines.reduce((s, l) => s + (l.right - l.left), 0);
        if (!total) return [text];
        const result = [];
        let cursor = 0;
        const len = text.length;
        for (let i = 0; i < lines.length; i++) {
            if (i === lines.length - 1) {
                result.push(text.slice(cursor));
            } else {
                const ratio = (lines[i].right - lines[i].left) / total;
                const take = Math.max(1, Math.round(len * ratio));
                result.push(text.slice(cursor, cursor + take));
                cursor += take;
            }
        }
        return result;
    }

    // 将指定容器的 SVG 加载到 stage（克隆 + 保留矢量缩放能力）
    function loadDiagram(targetContainer) {
        const targetSvg = targetContainer && targetContainer.querySelector('svg');
        if (!targetSvg) return false;

        baseW = 0; baseH = 0;
        if (targetSvg.viewBox && targetSvg.viewBox.baseVal && targetSvg.viewBox.baseVal.width) {
            baseW = targetSvg.viewBox.baseVal.width;
            baseH = targetSvg.viewBox.baseVal.height;
        }
        if (!baseW || !baseH) {
            const b = targetSvg.getBoundingClientRect();
            baseW = b.width || 600;
            baseH = b.height || 400;
        }

        const clonedSvg = targetSvg.cloneNode(true);
        // 确保 viewBox 存在，矢量缩放才能无损
        if (!clonedSvg.getAttribute('viewBox')) {
            clonedSvg.setAttribute('viewBox', `0 0 ${baseW} ${baseH}`);
        }
        clonedSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        // 清理硬编码尺寸，统一交给 applyTransform 通过 style 控制
        clonedSvg.removeAttribute('width');
        clonedSvg.removeAttribute('height');
        clonedSvg.style.maxWidth = 'none';
        clonedSvg.style.maxHeight = 'none';
        clonedSvg.style.display = 'block';

        stage.innerHTML = '';
        stage.appendChild(clonedSvg);
        // 临时按 1:1 显示，便于准确测量 foreignObject 内文本布局
        clonedSvg.style.width = baseW + 'px';
        clonedSvg.style.height = baseH + 'px';
        stage.style.width = baseW + 'px';
        stage.style.height = baseH + 'px';
        // 将 foreignObject 转为 SVG <text>，避免 Chromium 栅格化造成糊化
        rasterizeForeignObjectsToText(clonedSvg);
        return true;
    }

    function updateNavState() {
        if (siblings.length <= 1) {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
            counterLabel.textContent = '';
            return;
        }
        prevBtn.style.display = '';
        nextBtn.style.display = '';
        prevBtn.disabled = currentIndex <= 0;
        nextBtn.disabled = currentIndex >= siblings.length - 1;
        counterLabel.textContent = `(${currentIndex + 1}/${siblings.length})`;
    }

    function gotoIndex(idx) {
        if (idx < 0 || idx >= siblings.length || idx === currentIndex) return;
        if (loadDiagram(siblings[idx])) {
            currentIndex = idx;
            updateNavState();
            requestAnimationFrame(fitToViewport);
        }
    }

    function getSvgSize() {
        return { w: baseW, h: baseH };
    }

    function applyTransform() {
        // 缩放通过 SVG 的实际尺寸实现（矢量重栅格化，永不糊）
        // 平移交给 CSS transform，性能更好
        const w = baseW * scale;
        const h = baseH * scale;
        stage.style.width = w + 'px';
        stage.style.height = h + 'px';
        stage.style.transform = `translate(${tx}px, ${ty}px)`;
        const sv = stage.querySelector('svg');
        if (sv) {
            sv.style.width = w + 'px';
            sv.style.height = h + 'px';
        }
        scaleLabel.textContent = Math.round(scale * 100) + '%';
    }

    function fitToViewport() {
        const rect = viewport.getBoundingClientRect();
        const { w, h } = getSvgSize();
        const padding = 40;
        const sx = (rect.width - padding) / w;
        const sy = (rect.height - padding) / h;
        scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(sx, sy)));
        tx = (rect.width - w * scale) / 2;
        ty = (rect.height - h * scale) / 2;
        applyTransform();
    }

    function resetTo100() {
        const rect = viewport.getBoundingClientRect();
        const { w, h } = getSvgSize();
        scale = 1;
        tx = (rect.width - w) / 2;
        ty = (rect.height - h) / 2;
        applyTransform();
    }

    function zoomAtPoint(cx, cy, factor) {
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor));
        if (newScale === scale) return;
        const ratio = newScale / scale;
        tx = cx - (cx - tx) * ratio;
        ty = cy - (cy - ty) * ratio;
        scale = newScale;
        applyTransform();
    }

    // 初始化：加载首张并适应窗口（下一帧以便拿到容器尺寸）
    loadDiagram(siblings[currentIndex]);
    updateNavState();
    requestAnimationFrame(fitToViewport);

    // 滚轮缩放（以鼠标为中心）
    function onWheel(e) {
        e.preventDefault();
        const rect = viewport.getBoundingClientRect();
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        zoomAtPoint(e.clientX - rect.left, e.clientY - rect.top, factor);
    }
    viewport.addEventListener('wheel', onWheel, { passive: false });

    // 拖拽平移
    let dragging = false, dragSX = 0, dragSY = 0, origTx = 0, origTy = 0;
    function onMouseDown(e) {
        if (e.button !== 0) return;
        // 点击导航按钮时不触发拖拽
        if (e.target.closest('.mermaid-zoom-nav')) return;
        dragging = true;
        dragSX = e.clientX; dragSY = e.clientY;
        origTx = tx; origTy = ty;
        viewport.classList.add('dragging');
        e.preventDefault();
    }
    function onMouseMove(e) {
        if (!dragging) return;
        tx = origTx + (e.clientX - dragSX);
        ty = origTy + (e.clientY - dragSY);
        applyTransform();
    }
    function onMouseUp() {
        if (!dragging) return;
        dragging = false;
        viewport.classList.remove('dragging');
    }
    viewport.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // 双击适应
    viewport.addEventListener('dblclick', fitToViewport);

    // 工具栏按钮
    modal.querySelectorAll('.mermaid-zoom-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const act = btn.getAttribute('data-act');
            const rect = viewport.getBoundingClientRect();
            const cx = rect.width / 2, cy = rect.height / 2;
            if (act === 'zoom-in') zoomAtPoint(cx, cy, 1.2);
            else if (act === 'zoom-out') zoomAtPoint(cx, cy, 1 / 1.2);
            else if (act === 'fit') fitToViewport();
            else if (act === 'reset') resetTo100();
            else if (act === 'close') close();
        });
    });

    // 左右导航按钮
    prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        gotoIndex(currentIndex - 1);
    });
    nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        gotoIndex(currentIndex + 1);
    });

    // 点击遮罩关闭
    modal.addEventListener('mousedown', (e) => {
        if (e.target === modal) close();
    });

    // 键盘快捷键
    function onKeydown(e) {
        if (e.key === 'Escape') { close(); return; }
        if (e.key === 'ArrowLeft') {
            gotoIndex(currentIndex - 1);
            e.preventDefault();
            return;
        }
        if (e.key === 'ArrowRight') {
            gotoIndex(currentIndex + 1);
            e.preventDefault();
            return;
        }
        if (e.key === '+' || e.key === '=') {
            const rect = viewport.getBoundingClientRect();
            zoomAtPoint(rect.width / 2, rect.height / 2, 1.2);
        } else if (e.key === '-') {
            const rect = viewport.getBoundingClientRect();
            zoomAtPoint(rect.width / 2, rect.height / 2, 1 / 1.2);
        } else if (e.key === '0') {
            fitToViewport();
        } else if (e.key === '1') {
            resetTo100();
        }
    }
    document.addEventListener('keydown', onKeydown);

    function close() {
        document.removeEventListener('keydown', onKeydown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        modal.remove();
    }
}

// 暴露给 ai-chat.js 等模块复用
window.openMermaidZoomModal = openMermaidZoomModal;

// 导出Mermaid图表为图片
async function exportMermaidAsImage(container, index) {
    if (!window.html2canvas) {
        alert('图片导出功能需要html2canvas库');
        return;
    }

    try {
        // 找到SVG元素
        const svg = container.querySelector('svg');
        if (!svg) {
            alert('未找到图表SVG元素');
            return;
        }
        
        // 临时隐藏操作按钮
        const actions = container.querySelector('.mermaid-actions');
        if (actions) {
            actions.style.display = 'none';
        }
        
        // 使用html2canvas转换为canvas
        const canvas = await html2canvas(container, {
            backgroundColor: '#ffffff',
            scale: 2 // 提高分辨率
        });
        
        // 恢复操作按钮
        if (actions) {
            actions.style.display = '';
        }
        
        // 转换为blob并下载
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mermaid-diagram-${index + 1}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 'image/jpeg', 0.95);
        
    } catch (err) {
        console.error('导出图片失败:', err);
        alert('导出失败: ' + err.message);
    }
}

// ===== 文件实时监控 =====
let _lastDirMtime = 0;
let _lastFileMtime = 0;
let _watcherTimer = null;

function startFileWatcher() {
    if (_watcherTimer) return;
    _watcherTimer = setInterval(checkForUpdates, 3000);
    checkForUpdates();
}

async function checkForUpdates() {
    try {
        const params = new URLSearchParams();
        params.set('path', currentPath);
        if (selectedFile) params.set('file', selectedFile);

        const resp = await fetch('/api/library/check-updates?' + params);
        if (!resp.ok) return;
        const data = await resp.json();

        if (_lastDirMtime && data.dir_mtime > _lastDirMtime) {
            loadLibrary(currentPath, true);
        }
        _lastDirMtime = data.dir_mtime;

        if (selectedFile && _lastFileMtime && data.file_mtime > _lastFileMtime) {
            previewFile(selectedFile, true);
        }
        _lastFileMtime = data.file_mtime;
    } catch (e) {
        // ignore
    }
}

// ===== 目录栏交互状态机（滑动多选 + 自定义拖拽） =====

// 状态机模式：'idle' | 'swipe' | 'drag'
let _mouseMode = 'idle';
let _downX = 0;
let _downY = 0;
let _downPath = null;
let _downType = null;
let _downWasSelected = false;  // 按下时该项是否已勾选
let _pendingDrag = false;      // 是否为"双击按住"潜在拖拽
let _swipeToggled = new Set();
let _lastClickTime = 0;
let _lastClickPath = null;
let _customDragGhost = null;
let _currentDragOverEl = null;

const MOUSE_MOVE_THRESHOLD = 5;
const DOUBLE_CLICK_INTERVAL = 400;

// 获取文件项元素（通过事件目标向上查找）
function _getFileItemEl(target) {
    let el = target;
    while (el && el !== fileList) {
        if (el.classList && el.classList.contains('file-item')) {
            return el;
        }
        el = el.parentElement;
    }
    return null;
}

// CSS选择器转义
function _escapeSelector(str) {
    return str.replace(/([^\w-])/g, '\\$1');
}

// 通过 bounding rect 定位坐标下的文件项（与 CSS hover 区域一致）
function _findItemAtPoint(x, y) {
    if (!fileList) return null;
    const items = fileList.querySelectorAll('.file-item');
    for (const item of items) {
        const r = item.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
            return item;
        }
    }
    return null;
}

// 定位坐标下的放置目标（优先面包屑，其次文件列表中的 folder）
function _findDropTarget(x, y) {
    // 优先检测面包屑
    if (breadcrumb) {
        const crumbs = breadcrumb.querySelectorAll('.breadcrumb-item');
        for (const it of crumbs) {
            const r = it.getBoundingClientRect();
            if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
                return { el: it, path: it.dataset.path || '', kind: 'breadcrumb' };
            }
        }
    }
    // 文件列表项
    const itemEl = _findItemAtPoint(x, y);
    if (itemEl) {
        return {
            el: itemEl,
            path: itemEl.dataset.path,
            kind: itemEl.dataset.type === 'folder' ? 'folder' : 'file'
        };
    }
    return null;
}

// 创建自定义拖拽幽灵
function _createDragGhost(names, count, pos) {
    _removeDragGhost();

    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.style.left = (pos.clientX + 15) + 'px';
    ghost.style.top = (pos.clientY + 15) + 'px';

    if (count > 1) {
        ghost.innerHTML = `<span class="ghost-count">${count}</span><span>${names[0]} ...</span>`;
    } else {
        ghost.textContent = names[0];
    }

    document.body.appendChild(ghost);
    _customDragGhost = ghost;
}

function _removeDragGhost() {
    if (_customDragGhost) {
        _customDragGhost.remove();
        _customDragGhost = null;
    }
}

// 清理所有拖拽相关视觉状态
function _cleanupDragVisual() {
    if (fileList) {
        fileList.querySelectorAll('.file-item.dragging').forEach(el => el.classList.remove('dragging'));
        fileList.querySelectorAll('.file-item.drag-over').forEach(el => el.classList.remove('drag-over'));
        fileList.querySelectorAll('.file-item.drag-over-invalid').forEach(el => el.classList.remove('drag-over-invalid'));
    }
    if (breadcrumb) {
        breadcrumb.querySelectorAll('.breadcrumb-item.drag-over').forEach(el => el.classList.remove('drag-over'));
        breadcrumb.querySelectorAll('.breadcrumb-item.drag-over-invalid').forEach(el => el.classList.remove('drag-over-invalid'));
    }
    _currentDragOverEl = null;
    _removeDragGhost();
}

// 启动自定义拖拽
function _startCustomDrag(e) {
    // 收集所有勾选项（至少含按下的项）
    let paths = Array.from(selectedExportFiles);
    if (paths.length === 0 && _downPath) {
        paths = [_downPath];
    }
    const names = paths.map(p => p.split('/').pop());

    // 标记拖拽中
    paths.forEach(p => {
        const el = fileList.querySelector(`.file-item[data-path="${_escapeSelector(p)}"]`);
        if (el) el.classList.add('dragging');
    });

    _createDragGhost(names, paths.length, { clientX: e.clientX, clientY: e.clientY });
    _mouseMode = 'drag';
}

// 更新拖拽过程中的目标项视觉反馈
function _updateDragOver(target) {
    const el = target ? target.el : null;
    // 清除上一次的高亮
    if (_currentDragOverEl && _currentDragOverEl !== el) {
        _currentDragOverEl.classList.remove('drag-over');
        _currentDragOverEl.classList.remove('drag-over-invalid');
    }
    _currentDragOverEl = el;
    if (!target) return;

    const path = target.path;
    const isFolderTarget = target.kind === 'folder' || target.kind === 'breadcrumb';

    if (isFolderTarget) {
        // 勾选项中任一等于目标或是目标祖先 → 非法
        const sources = Array.from(selectedExportFiles.size > 0 ? selectedExportFiles : [_downPath]);
        const invalid = sources.some(s => {
            if (!s) return true;
            if (s === path) return true;
            if (path === '') return false;              // 根目录总是允许
            if (path.startsWith(s + '/')) return true;  // 不能移到自己子目录
            return false;
        });
        if (invalid) {
            el.classList.add('drag-over-invalid');
            el.classList.remove('drag-over');
        } else {
            el.classList.add('drag-over');
            el.classList.remove('drag-over-invalid');
        }
    } else {
        el.classList.add('drag-over-invalid');
        el.classList.remove('drag-over');
    }
}

// 完成自定义拖拽（放置）
async function _finishCustomDrop(e) {
    const target = _findDropTarget(e.clientX, e.clientY);
    _cleanupDragVisual();

    if (!target) return;

    const targetPath = target.path;
    const isFolderTarget = target.kind === 'folder' || target.kind === 'breadcrumb';

    if (!isFolderTarget) {
        showError(t('invalid_drop_target'));
        return;
    }

    // 目标显示名
    let targetName;
    if (target.kind === 'breadcrumb') {
        targetName = targetPath === '' ? t('root_dir') : targetPath.split('/').pop();
    } else {
        targetName = target.el.dataset.itemName || targetPath.split('/').pop();
    }

    // 收集源路径
    let sources = Array.from(selectedExportFiles);
    if (sources.length === 0 && _downPath) sources = [_downPath];

    // 过滤非法目标
    const validPaths = sources.filter(p => {
        if (!p) return false;
        if (p === targetPath) return false;
        if (targetPath === '') return true; // 根目录总是允许
        if (targetPath.startsWith(p + '/')) return false;
        return true;
    });
    if (validPaths.length === 0) return;

    // 确认
    if (validPaths.length === 1) {
        const itemName = validPaths[0].split('/').pop();
        if (!confirm(t('move_confirm', { item: itemName, target: targetName }))) return;
    } else {
        if (!confirm(t('batch_move_confirm', { count: validPaths.length, target: targetName }))) return;
    }

    await moveItems(validPaths, targetPath);
    _clearAllSelections();
}


// ===== 批量移动 =====
async function moveItems(sources, target) {
    if (sources.length === 1) {
        return moveItem(sources[0], target);
    }

    try {
        const response = await fetch('/api/library/move/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sources, target })
        });

        const data = await response.json();

        if (data.success) {
            showSuccess(t('batch_move_success', { count: data.moved }));
            loadLibrary(currentPath);
        } else {
            showError(data.message || t('batch_move_fail'));
        }
    } catch (error) {
        showError(t('batch_move_fail') + ': ' + error.message);
    }
}

// ===== 鼠标事件状态机（统一处理滑动多选与自定义拖拽） =====

function onFileListMouseDown(e) {
    // 仅左键
    if (e.button !== 0) return;
    // 忽略菜单按钮与复选框区域（复选框让浏览器原生处理）
    if (e.target.closest('.file-menu-btn')) return;
    if (e.target.closest('.file-select')) return;

    const itemEl = _getFileItemEl(e.target);

    _downX = e.clientX;
    _downY = e.clientY;
    _mouseMode = 'idle';
    _swipeToggled.clear();

    if (!itemEl) {
        _downPath = null;
        _downType = null;
        _downWasSelected = false;
        _pendingDrag = false;
        return;
    }

    _downPath = itemEl.dataset.path;
    _downType = itemEl.dataset.type;
    _downWasSelected = selectedExportFiles.has(_downPath);

    // 判定是否为"双击按住"：距上次 click 时间小于阈值且同项 + 已勾选
    const now = Date.now();
    _pendingDrag = (
        _downWasSelected &&
        _lastClickPath === _downPath &&
        (now - _lastClickTime) < DOUBLE_CLICK_INTERVAL
    );
}

function onFileListMouseMove(e) {
    if (e.buttons !== 1) return;
    if (!_downPath && _mouseMode === 'idle') return;

    const dx = e.clientX - _downX;
    const dy = e.clientY - _downY;

    if (_mouseMode === 'idle') {
        if (Math.hypot(dx, dy) < MOUSE_MOVE_THRESHOLD) return;

        if (_pendingDrag) {
            _startCustomDrag(e);
        } else {
            _mouseMode = 'swipe';
        }
        // 进入交互模式后隐藏悬浮提示
        _hideTooltip();
    }

    if (_mouseMode === 'swipe') {
        const itemEl = _findItemAtPoint(e.clientX, e.clientY);
        if (!itemEl) return;
        const path = itemEl.dataset.path;
        if (!path || _swipeToggled.has(path)) return;
        _swipeToggled.add(path);
        const cb = itemEl.querySelector('.file-select input[type="checkbox"]');
        if (cb) cb.click();
    } else if (_mouseMode === 'drag') {
        // 更新幽灵位置
        if (_customDragGhost) {
            _customDragGhost.style.left = (e.clientX + 15) + 'px';
            _customDragGhost.style.top = (e.clientY + 15) + 'px';
        }
        // 更新 hover 目标（面包屑 + 文件夹）
        const target = _findDropTarget(e.clientX, e.clientY);
        _updateDragOver(target);
    }
}

async function onFileListMouseUp(e) {
    const mode = _mouseMode;
    const downPath = _downPath;
    const downType = _downType;
    const downWasSelected = _downWasSelected;

    // 统一先重置瞬态状态（拖拽的异步收尾独立处理）
    _mouseMode = 'idle';
    _downPath = null;
    _downType = null;
    _downWasSelected = false;
    _pendingDrag = false;
    _swipeToggled.clear();

    if (mode === 'drag') {
        await _finishCustomDrop(e);
        // 拖拽完成后重置 click 追踪，避免误触发后续双击
        _lastClickTime = 0;
        _lastClickPath = null;
        return;
    }

    if (mode === 'swipe') {
        // 滑动多选不触发 click / dblclick 语义
        _lastClickTime = 0;
        _lastClickPath = null;
        return;
    }

    // mode === 'idle'：未移动，视为一次 click
    if (!downPath) return;

    const now = Date.now();
    const isSecondClick = (
        _lastClickPath === downPath &&
        (now - _lastClickTime) < DOUBLE_CLICK_INTERVAL
    );

    if (isSecondClick) {
        // 第二次 click 完成 → 双击
        if (!downWasSelected) {
            // 未勾选项的双击：打开/进入
            handleFileClick(downPath, downType);
        }
        // 已勾选项的纯双击：什么都不做
        _lastClickTime = 0;
        _lastClickPath = null;
    } else {
        // 第一次 click：仅记录；主体单击不做事
        _lastClickTime = now;
        _lastClickPath = downPath;
    }
}


// 清除所有勾选
function _clearAllSelections() {
    selectedExportFiles.forEach(path => {
        const el = fileList.querySelector(`.file-item[data-path="${_escapeSelector(path)}"]`);
        if (el) {
            const cb = el.querySelector('.file-select input[type="checkbox"]');
            if (cb) cb.checked = false;
        }
    });
    selectedExportFiles.clear();
    updateExportSelectionState();
}

// ===== 文件项悬浮操作提示 tooltip =====
let _fileItemTooltip = null;
let _tooltipCurrentItem = null;
let _tooltipPendingItem = null;
let _tooltipTimer = null;
let _tooltipLastX = 0;
let _tooltipLastY = 0;
const TOOLTIP_DELAY = 1000;

function _ensureTooltip() {
    if (_fileItemTooltip) return _fileItemTooltip;
    const el = document.createElement('div');
    el.className = 'file-item-tooltip';
    document.body.appendChild(el);
    _fileItemTooltip = el;
    return el;
}

function _clearTooltipTimer() {
    if (_tooltipTimer) {
        clearTimeout(_tooltipTimer);
        _tooltipTimer = null;
    }
    _tooltipPendingItem = null;
}

function _hideTooltip() {
    _clearTooltipTimer();
    if (_fileItemTooltip) {
        _fileItemTooltip.classList.remove('show');
    }
    _tooltipCurrentItem = null;
}

function _updateTooltipPosition(x, y) {
    if (!_fileItemTooltip) return;
    // 光标右下偏移；贴近视口边缘时翻转
    const tip = _fileItemTooltip;
    const margin = 14;
    let left = x + margin;
    let top = y + margin + 4;
    const rect = tip.getBoundingClientRect();
    if (left + rect.width > window.innerWidth - 8) {
        left = x - rect.width - margin;
    }
    if (top + rect.height > window.innerHeight - 8) {
        top = y - rect.height - margin;
    }
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
}

function _scheduleTooltip(itemEl, x, y) {
    // 已显示且是同一项 → 仅更新位置
    if (_tooltipCurrentItem === itemEl && _fileItemTooltip && _fileItemTooltip.classList.contains('show')) {
        _updateTooltipPosition(x, y);
        return;
    }
    // 换项或未显示 → 重置计时器
    if (_tooltipPendingItem === itemEl) {
        _tooltipLastX = x;
        _tooltipLastY = y;
        return;
    }
    _clearTooltipTimer();
    if (_fileItemTooltip) _fileItemTooltip.classList.remove('show');
    _tooltipCurrentItem = null;
    _tooltipPendingItem = itemEl;
    _tooltipLastX = x;
    _tooltipLastY = y;
    _tooltipTimer = setTimeout(() => {
        _tooltipTimer = null;
        const el = _tooltipPendingItem;
        _tooltipPendingItem = null;
        if (!el) return;
        // 交互进行中则不显示
        if (_mouseMode !== 'idle') return;
        const path = el.dataset.path;
        if (!path) return;
        const isSelected = selectedExportFiles.has(path);
        const text = isSelected ? t('tooltip_item_selected') : t('tooltip_item_unselected');
        const tip = _ensureTooltip();
        tip.textContent = text;
        _updateTooltipPosition(_tooltipLastX, _tooltipLastY);
        tip.classList.add('show');
        _tooltipCurrentItem = el;
    }, TOOLTIP_DELAY);
}

function onFileListMouseOver(e) {
    // 状态机激活（滑动/拖拽）期间不显示 tooltip
    if (_mouseMode !== 'idle') return _hideTooltip();
    // 悬浮到菜单按钮或复选框区域时不显示
    if (e.target.closest('.file-menu-btn') || e.target.closest('.file-select')) {
        return _hideTooltip();
    }
    const itemEl = _getFileItemEl(e.target);
    if (!itemEl) return _hideTooltip();
    _scheduleTooltip(itemEl, e.clientX, e.clientY);
}

function onFileListMouseMoveTooltip(e) {
    if (_mouseMode !== 'idle') return _hideTooltip();
    if (e.target.closest('.file-menu-btn') || e.target.closest('.file-select')) {
        return _hideTooltip();
    }
    const itemEl = _getFileItemEl(e.target);
    if (!itemEl) return _hideTooltip();
    _scheduleTooltip(itemEl, e.clientX, e.clientY);
}

function onFileListMouseOut(e) {
    // 鼠标移出 fileList（relatedTarget 不在 fileList 内）时隐藏
    const to = e.relatedTarget;
    if (!to || !fileList.contains(to)) {
        _hideTooltip();
    }
}
