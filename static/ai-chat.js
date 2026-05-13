// ===== MarkiNote AI 助手 =====

(function () {
    'use strict';

    // --- 状态 ---
    let aiConversationId = '';
    let aiIsStreaming = false;
    let aiEventSource = null;
    let aiAbortController = null;
    let aiShowingHistory = false;
    let userMsgCounter = 0;
    let aiAttachedFiles = [];
    let _aiKeyValidated = null;  // null=未验证, true=验证成功, false=验证失败

    // --- DOM ---
    const aiPanel = document.getElementById('aiPanel');
    const aiToggleBtn = document.getElementById('aiToggleBtn');
    const aiCloseBtn = document.getElementById('aiCloseBtn');
    const aiSettingsBtn = document.getElementById('aiSettingsBtn');
    const aiHistoryBtn = document.getElementById('aiHistoryBtn');
    const aiNewChatBtn = document.getElementById('aiNewChatBtn');
    const aiSettingsPanel = document.getElementById('aiSettingsPanel');
    const aiHistoryPanel = document.getElementById('aiHistoryPanel');
    const aiHistoryList = document.getElementById('aiHistoryList');
    const aiChatArea = document.getElementById('aiChatArea');
    const aiMessages = document.getElementById('aiMessages');
    const aiInput = document.getElementById('aiInput');
    const aiSendBtn = document.getElementById('aiSendBtn');
    const aiProviderSelect = document.getElementById('aiProviderSelect');
    const aiModelSelect = document.getElementById('aiModelSelect');
    const aiApiKeyInput = document.getElementById('aiApiKeyInput');
    const aiValidateKeyBtn = document.getElementById('aiValidateKeyBtn');
    const aiKeyStatus = document.getElementById('aiKeyStatus');
    const aiContextBar = document.getElementById('aiContextBar');
    const aiContextFile = document.getElementById('aiContextFile');
    const aiContextClear = document.getElementById('aiContextClear');
    const aiAttachBtn = document.getElementById('aiAttachBtn');
    const aiAttachmentsEl = document.getElementById('aiAttachments');
    const aiApiDot = document.getElementById('aiApiDot');
    const aiApiWarning = document.getElementById('aiApiWarning');
    const aiApiWarningBtn = document.getElementById('aiApiWarningBtn');

    // --- 初始化 ---
    function initAI() {
        // 配置 marked.js（用于 Markdown 渲染）
        if (typeof marked !== 'undefined') {
            marked.setOptions({ breaks: true, gfm: true });
        }
        loadAISettings();
        setupAIListeners();
        updateModelOptions();
        initResizeHandles();
        restorePanelSizes();
    }

    function setupAIListeners() {
        aiToggleBtn.addEventListener('click', toggleAIPanel);
        aiCloseBtn.addEventListener('click', toggleAIPanel);
        aiSettingsBtn.addEventListener('click', toggleSettings);
        aiHistoryBtn.addEventListener('click', toggleHistory);
        aiNewChatBtn.addEventListener('click', newChat);
        aiSendBtn.addEventListener('click', sendMessage);
        aiProviderSelect.addEventListener('change', onProviderChange);
        aiValidateKeyBtn.addEventListener('click', validateKey);
        if (aiContextClear) aiContextClear.addEventListener('click', clearContext);
        aiAttachBtn.addEventListener('click', showFilePicker);

        // API 状态指示灯和警告
        if (aiApiDot) aiApiDot.addEventListener('click', () => toggleSettings());
        if (aiApiWarningBtn) aiApiWarningBtn.addEventListener('click', () => { toggleSettings(); });
        aiApiKeyInput.addEventListener('input', () => {
            _aiKeyValidated = null;
            aiKeyStatus.className = 'ai-key-status';
            aiKeyStatus.style.display = 'none';
            updateApiStatus();
        });

        aiInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        aiInput.addEventListener('input', autoResizeInput);
    }

    // --- 面板切换 ---
    function toggleAIPanel() {
        const container = document.querySelector('.app-container');
        container.classList.toggle('ai-panel-open');
        const isOpen = container.classList.contains('ai-panel-open');
        localStorage.setItem('aiPanelOpen', isOpen ? 'true' : 'false');
        if (isOpen && !aiConversationId) {
            showWelcome();
        }
    }

    function toggleSettings() {
        aiSettingsPanel.classList.toggle('show');
        if (aiSettingsPanel.classList.contains('show')) {
            hideHistory();
            if (aiApiWarning) aiApiWarning.classList.remove('show');
        } else {
            updateApiStatus();
        }
    }

    function toggleHistory() {
        if (aiShowingHistory) {
            hideHistory();
        } else {
            showHistory();
        }
    }

    function showHistory() {
        aiShowingHistory = true;
        aiHistoryPanel.classList.add('show');
        aiChatArea.style.display = 'none';
        loadConversationList();
    }

    function hideHistory() {
        aiShowingHistory = false;
        aiHistoryPanel.classList.remove('show');
        aiChatArea.style.display = 'flex';
    }

    // --- 设置管理 ---
    let _aiSettingsLoaded = false;

    async function loadAISettings() {
        try {
            const resp = await fetch('/api/ai/settings');
            const data = await resp.json();
            if (data.success && data.settings) {
                const s = data.settings;
                aiProviderSelect.value = s.provider || 'deepseek';
                updateModelOptions();
                aiModelSelect.value = s.model || 'deepseek-v4-pro';
                aiApiKeyInput.value = s.api_key || '';
            }
        } catch (e) {
            // 网络错误时使用默认值
            aiProviderSelect.value = 'deepseek';
            updateModelOptions();
            aiModelSelect.value = 'deepseek-v4-pro';
            aiApiKeyInput.value = '';
        }
        _aiSettingsLoaded = true;

        updateApiStatus();

        const panelOpen = localStorage.getItem('aiPanelOpen') === 'true';
        if (panelOpen) {
            document.querySelector('.app-container').classList.add('ai-panel-open');
            showWelcome();
        }
    }

    async function saveAISettings() {
        try {
            await fetch('/api/ai/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: aiProviderSelect.value,
                    model: aiModelSelect.value,
                    api_key: aiApiKeyInput.value
                })
            });
        } catch (e) {
            // 静默处理保存失败
        }
        updateApiStatus();
    }

    function updateApiStatus() {
        const hasKey = aiApiKeyInput.value.trim().length > 0;
        if (aiApiDot) {
            if (!hasKey) {
                aiApiDot.className = 'ai-api-dot missing';
                aiApiDot.title = '未配置 API Key — 点击设置';
            } else if (_aiKeyValidated === false) {
                aiApiDot.className = 'ai-api-dot invalid';
                aiApiDot.title = 'API Key 验证失败 — 点击设置';
            } else if (_aiKeyValidated === true) {
                aiApiDot.className = 'ai-api-dot configured';
                aiApiDot.title = 'API Key 已验证通过';
            } else {
                // hasKey but not validated yet
                aiApiDot.className = 'ai-api-dot configured';
                aiApiDot.title = 'API Key 已配置（未验证）— 点击设置';
            }
        }
        if (aiApiWarning) {
            aiApiWarning.classList.toggle('show', !hasKey);
        }
    }

    function onProviderChange() {
        updateModelOptions();
        saveAISettings();
        _aiKeyValidated = null;
        aiKeyStatus.className = 'ai-key-status';
        aiKeyStatus.style.display = 'none';
        updateApiStatus();
    }

    function updateModelOptions() {
        const models = {
            deepseek: [
                { id: 'deepseek-v4-pro', name: 'DeepSeek-V4 Pro' },
                { id: 'deepseek-v4-flash', name: 'DeepSeek-V4 Flash' },
                { id: 'deepseek-chat', name: 'DeepSeek-V3.2' }
            ],
            kimi: [
                { id: 'kimi-for-coding', name: 'Kimi Code' }
            ]
        };

        const provider = aiProviderSelect.value;
        const list = models[provider] || [];
        const prevModel = aiModelSelect.value;
        aiModelSelect.innerHTML = list.map(m =>
            `<option value="${m.id}">${m.name}</option>`
        ).join('');

        if (list.some(m => m.id === prevModel)) {
            aiModelSelect.value = prevModel;
        }
    }

    async function validateKey() {
        const key = aiApiKeyInput.value.trim();
        if (!key) {
            showKeyStatus(t('enter_api_key'), false);
            return;
        }
        saveAISettings();
        aiValidateKeyBtn.disabled = true;
        aiValidateKeyBtn.textContent = t('validating');

        try {
            const resp = await fetch('/api/ai/validate-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: aiProviderSelect.value,
                    api_key: key
                })
            });
            const data = await resp.json();
            _aiKeyValidated = data.success;
            showKeyStatus(data.message, data.success);
            updateApiStatus();
        } catch (e) {
            _aiKeyValidated = false;
            showKeyStatus(t('validate_fail') + e.message, false);
            updateApiStatus();
        } finally {
            aiValidateKeyBtn.disabled = false;
            aiValidateKeyBtn.textContent = t('validate');
        }
    }

    function showKeyStatus(msg, success) {
        aiKeyStatus.textContent = msg;
        aiKeyStatus.className = 'ai-key-status ' + (success ? 'success' : 'error');
        aiKeyStatus.style.display = 'block';
    }

    // --- 上下文文件（自动附件） ---
    let aiContextFilePath = '';

    function setContextFile(filePath) {
        aiContextFilePath = filePath || '';
        aiContextFile.textContent = aiContextFilePath;
        renderAttachments();
    }

    function clearContext() {
        aiContextFilePath = '';
        aiContextFile.textContent = '';
        renderAttachments();
    }

    // 暴露给外部 script.js 调用
    window.setAIContextFile = setContextFile;

    // --- 文件附件 ---
    async function showFilePicker() {
        const existing = document.querySelector('.ai-file-picker');
        if (existing) { existing.remove(); return; }

        const picker = document.createElement('div');
        picker.className = 'ai-file-picker';
        picker.innerHTML = '<div class="ai-file-picker-loading">' + t('loading') + '</div>';

        const inputArea = document.querySelector('.ai-input-area');
        inputArea.parentNode.insertBefore(picker, inputArea);

        const closeHandler = (e) => {
            if (!picker.contains(e.target) && e.target !== aiAttachBtn && !aiAttachBtn.contains(e.target)) {
                picker.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);

        await loadPickerDir(picker, '');
    }

    async function loadPickerDir(picker, path) {
        try {
            const resp = await fetch(`/api/library/list?path=${encodeURIComponent(path)}`);
            const data = await resp.json();
            if (data.success) {
                let html = '';
                if (path) {
                    const parent = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
                    html += `<div class="ai-file-picker-item folder" data-path="${escapeHtml(parent)}" data-action="nav">
                        <span>${t('back_up')}</span>
                    </div>`;
                }
                for (const item of data.items) {
                    if (item.type === 'folder') {
                        html += `<div class="ai-file-picker-item folder" data-path="${escapeHtml(item.path)}" data-action="nav">
                            <span>\uD83D\uDCC1 ${escapeHtml(item.name)}</span>
                        </div>`;
                    } else {
                        const attached = aiAttachedFiles.includes(item.path);
                        html += `<div class="ai-file-picker-item file ${attached ? 'attached' : ''}" data-path="${escapeHtml(item.path)}" data-action="attach">
                            <span>\uD83D\uDCC4 ${escapeHtml(item.name)}</span>
                            ${attached ? '<span class="ai-file-attached-mark">\u2713</span>' : ''}
                        </div>`;
                    }
                }
                if (!data.items.length && !path) html = '<div class="ai-file-picker-empty">' + t('no_files') + '</div>';
                picker.innerHTML = html;
                picker.querySelectorAll('.ai-file-picker-item').forEach(el => {
                    el.addEventListener('click', async () => {
                        if (el.dataset.action === 'nav') {
                            await loadPickerDir(picker, el.dataset.path);
                        } else {
                            const p = el.dataset.path;
                            if (!aiAttachedFiles.includes(p)) {
                                aiAttachedFiles.push(p);
                                renderAttachments();
                            }
                            picker.remove();
                        }
                    });
                });
            }
        } catch (e) {
            picker.innerHTML = '<div class="ai-file-picker-empty">' + t('load_failed') + '</div>';
        }
    }

    function renderAttachments() {
        const allEmpty = !aiContextFilePath && aiAttachedFiles.length === 0;
        if (allEmpty) {
            aiAttachmentsEl.style.display = 'none';
            aiAttachmentsEl.innerHTML = '';
            return;
        }
        aiAttachmentsEl.style.display = 'flex';
        let html = '';

        if (aiContextFilePath) {
            const ctxName = aiContextFilePath.includes('/') ? aiContextFilePath.substring(aiContextFilePath.lastIndexOf('/') + 1) : aiContextFilePath;
            html += `<div class="ai-attachment-chip context-chip">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H4z"/><path d="M9.998 5.083 10 5a2 2 0 1 0-4 0v.062a2.5 2.5 0 0 0 0 4.876V10a2 2 0 1 0 4 0v-.062a2.5 2.5 0 0 0 0-4.876z"/></svg>
                <span title="${escapeHtml(aiContextFilePath)}">${t('current_prefix')}${escapeHtml(ctxName)}</span>
                <button data-action="clear-ctx" title="${t('remove_label')}">\u00D7</button>
            </div>`;
        }

        html += aiAttachedFiles.map((f, i) => {
            const name = f.includes('/') ? f.substring(f.lastIndexOf('/') + 1) : f;
            return `<div class="ai-attachment-chip">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5z"/></svg>
                <span title="${escapeHtml(f)}">${escapeHtml(name)}</span>
                <button data-idx="${i}" title="${t('remove_label')}">\u00D7</button>
            </div>`;
        }).join('');

        aiAttachmentsEl.innerHTML = html;
        aiAttachmentsEl.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.action === 'clear-ctx') {
                    clearContext();
                } else {
                    aiAttachedFiles.splice(parseInt(btn.dataset.idx), 1);
                    renderAttachments();
                }
            });
        });
    }

    // --- 对话管理 ---
    function newChat() {
        aiConversationId = '';
        aiMessages.innerHTML = '';
        userMsgCounter = 0;
        aiAttachedFiles = [];
        aiProgressCard = null;
        aiProgressSteps = [];
        aiProgressStepIndex = 0;
        renderAttachments();
        showWelcome();
        hideHistory();
        if (aiIsStreaming) stopStreaming();
        const picker = document.querySelector('.ai-file-picker');
        if (picker) picker.remove();
    }

    async function handleRollbackMessage(msgEl) {
        if (aiIsStreaming) {
            alert(t('wait_ai'));
            return;
        }
        const idx = parseInt(msgEl.dataset.userMsgIndex);
        if (!confirm(t('rollback_confirm'))) return;

        if (aiConversationId) {
            try {
                const resp = await fetch(`/api/ai/conversations/${aiConversationId}/truncate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_msg_number: idx, include_user_msg: true })
                });
                const data = await resp.json();
                if (!data.success) {
                    alert(t('rollback_fail') + (data.error || data.message));
                    return;
                }
            } catch (e) {
                alert(t('rollback_request_fail') + e.message);
                return;
            }
        }

        removeMessagesAfter(msgEl);
        userMsgCounter = idx + 1;

        if (typeof loadLibrary === 'function') {
            setTimeout(() => loadLibrary(currentPath), 300);
        }
        if (typeof selectedFile !== 'undefined' && selectedFile && typeof previewFile === 'function') {
            setTimeout(() => previewFile(selectedFile), 500);
        }
    }

    async function handleEditMessage(msgEl) {
        if (aiIsStreaming) {
            alert(t('wait_ai'));
            return;
        }
        const idx = parseInt(msgEl.dataset.userMsgIndex);
        const content = msgEl.dataset.userMsgContent;
        if (!confirm(t('edit_confirm'))) return;

        if (aiConversationId) {
            try {
                const resp = await fetch(`/api/ai/conversations/${aiConversationId}/truncate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_msg_number: idx, include_user_msg: false })
                });
                const data = await resp.json();
                if (!data.success) {
                    alert(t('rollback_fail') + (data.error || data.message));
                    return;
                }
            } catch (e) {
                alert(t('rollback_request_fail') + e.message);
                return;
            }
        }

        removeMessagesFrom(msgEl);
        userMsgCounter = idx;

        aiInput.value = content;
        autoResizeInput();
        aiInput.focus();

        if (typeof loadLibrary === 'function') {
            setTimeout(() => loadLibrary(currentPath), 300);
        }
        if (typeof selectedFile !== 'undefined' && selectedFile && typeof previewFile === 'function') {
            setTimeout(() => previewFile(selectedFile), 500);
        }
    }

    function removeMessagesAfter(msgEl) {
        let sibling = msgEl.nextElementSibling;
        while (sibling) {
            const next = sibling.nextElementSibling;
            sibling.remove();
            sibling = next;
        }
    }

    function removeMessagesFrom(msgEl) {
        let sibling = msgEl.nextElementSibling;
        while (sibling) {
            const next = sibling.nextElementSibling;
            sibling.remove();
            sibling = next;
        }
        msgEl.remove();
    }

    function showWelcome() {
        if (aiMessages.children.length > 0 && !aiMessages.querySelector('.ai-welcome')) return;
        aiMessages.innerHTML = `
            <div class="ai-welcome">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/>
                    <path d="M10 21h4"/>
                    <path d="M12 18v3"/>
                </svg>
                <h3>${t('ai_welcome_title')}</h3>
                <p>${t('ai_welcome_desc')}<br>
                ${t('ai_welcome_hint')}</p>
            </div>
        `;
    }

    async function loadConversationList() {
        aiHistoryList.innerHTML = '<div class="loading" style="padding:20px">' + t('loading') + '</div>';
        try {
            const resp = await fetch('/api/ai/conversations');
            const data = await resp.json();
            if (data.success && data.conversations.length > 0) {
                aiHistoryList.innerHTML = data.conversations.map(c => `
                    <div class="ai-history-item" onclick="window._aiLoadConv('${c.id}')">
                        <div class="ai-history-item-info">
                            <div class="ai-history-item-title" data-conv-id="${c.id}">${escapeHtml(c.title)}</div>
                            <div class="ai-history-item-meta">${formatRelativeTime(c.updated_at)} · ${t('messages_count', {count: c.message_count})}</div>
                        </div>
                        <div class="ai-history-item-actions">
                            <button class="ai-history-item-action" onclick="event.stopPropagation();window._aiRenameConv('${c.id}',this)" title="${t('rename')}">
                                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zM13.5 6.207L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5z"/>
                                    <path d="M6.032 13.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"/>
                                </svg>
                            </button>
                            <button class="ai-history-item-action danger" onclick="event.stopPropagation();window._aiDeleteConv('${c.id}',this)" title="${t('delete_word')}">
                                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                    <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                `).join('');
            } else {
                aiHistoryList.innerHTML = '<div class="loading" style="padding:20px;color:var(--text-secondary)">' + t('no_conversations') + '</div>';
            }
        } catch (e) {
            aiHistoryList.innerHTML = '<div class="loading" style="padding:20px;color:var(--danger-color)">' + t('load_failed') + '</div>';
        }
    }

    window._aiLoadConv = async function (id) {
        try {
            const resp = await fetch(`/api/ai/conversations/${id}`);
            const data = await resp.json();
            if (data.success) {
                aiConversationId = id;
                aiMessages.innerHTML = '';
                userMsgCounter = 0;
                const msgs = data.conversation.messages;
                let currentAssistantEl = null;
                let hasToolCallsInProgress = false;

                for (const m of msgs) {
                    if (m.role === 'user') {
                        appendMessage('user', m.content);
                        currentAssistantEl = null;
                        hasToolCallsInProgress = false;
                    } else if (m.role === 'assistant') {
                        if (hasToolCallsInProgress && currentAssistantEl) {
                            if (m.content) {
                                const newBubble = document.createElement('div');
                                newBubble.className = 'ai-msg-bubble';
                                newBubble.innerHTML = renderChatMarkdown(m.content);
                                currentAssistantEl.appendChild(newBubble);
                            }
                            if (!m.tool_calls) hasToolCallsInProgress = false;
                        } else {
                            currentAssistantEl = appendMessage('assistant', m.content || '');
                        }

                        if (m.tool_calls) {
                            hasToolCallsInProgress = true;
                            if (!m.content && currentAssistantEl) {
                                const emptyBubble = currentAssistantEl.querySelector('.ai-msg-bubble');
                                if (emptyBubble && !emptyBubble.textContent.trim()) emptyBubble.remove();
                            }
                            for (const tc of m.tool_calls) {
                                const card = appendToolCard(tc.id, tc.function.name, JSON.parse(tc.function.arguments || '{}'), null, null, currentAssistantEl);
                                if (card) card.classList.add('no-animate');
                            }
                        }
                    } else if (m.role === 'tool' && m.tool_meta) {
                        updateToolCard(m.tool_meta.name, m.content, m.tool_meta.backup_info, m.tool_meta.backup_group_id);
                    }
                }
                hideHistory();
                scrollToBottom();
                // 渲染 Mermaid 图表
                renderMermaidInChat();
            }
        } catch (e) {
            console.error('加载对话失败:', e);
        }
    };

    window._aiRenameConv = function (id, btn) {
        const item = btn.closest('.ai-history-item');
        const titleEl = item.querySelector('.ai-history-item-title');
        const oldTitle = titleEl.textContent;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = oldTitle;
        input.className = 'ai-history-rename-input';
        input.style.cssText = 'width:100%;padding:2px 6px;font-size:14px;border:1px solid var(--primary-color);border-radius:4px;background:var(--sidebar-bg);color:var(--text-color);outline:none;';

        titleEl.replaceWith(input);
        input.focus();
        input.select();

        const doRename = async () => {
            const newTitle = input.value.trim();
            if (newTitle && newTitle !== oldTitle) {
                try {
                    await fetch(`/api/ai/conversations/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: newTitle })
                    });
                    titleEl.textContent = newTitle;
                } catch (e) {
                    titleEl.textContent = oldTitle;
                }
            } else {
                titleEl.textContent = oldTitle;
            }
            input.replaceWith(titleEl);
        };

        input.addEventListener('blur', doRename);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            if (e.key === 'Escape') { input.value = oldTitle; input.blur(); }
        });
        input.addEventListener('click', (e) => e.stopPropagation());
    };

    window._aiDeleteConv = async function (id, btn) {
        if (!confirm(t('delete_conv_confirm'))) return;
        try {
            await fetch(`/api/ai/conversations/${id}`, { method: 'DELETE' });
            const item = btn.closest('.ai-history-item');
            if (item) item.remove();
            if (id === aiConversationId) newChat();
        } catch (e) {
            console.error('删除失败:', e);
        }
    };

    // --- 发送消息 ---
    async function sendMessage() {
        const text = aiInput.value.trim();
        if (!text || aiIsStreaming) return;

        const apiKey = aiApiKeyInput.value.trim();
        if (!apiKey) {
            aiSettingsPanel.classList.add('show');
            showKeyStatus(t('set_api_key_first'), false);
            aiApiKeyInput.focus();
            return;
        }
        saveAISettings();

        const welcome = aiMessages.querySelector('.ai-welcome');
        if (welcome) welcome.remove();

        const filesForSend = [...aiAttachedFiles];
        aiAttachedFiles = [];
        renderAttachments();

        appendMessage('user', text);
        aiInput.value = '';
        aiInput.style.height = '22px';

        const contextFile = aiContextFilePath || '';

        aiIsStreaming = true;
        updateSendButton();

        const assistantEl = appendMessage('assistant', '');
        const bubbleEl = assistantEl.querySelector('.ai-msg-bubble');
        showTypingIndicator(bubbleEl);

        // 创建进度卡片
        createProgressCard(assistantEl);

        aiAbortController = new AbortController();

        try {
            const resp = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    conversation_id: aiConversationId,
                    provider: aiProviderSelect.value,
                    model: aiModelSelect.value,
                    api_key: apiKey,
                    context_file: contextFile,
                    attached_files: filesForSend,
                    language: localStorage.getItem('appLanguage') || 'zh-CN'
                }),
                signal: aiAbortController.signal
            });

            if (!resp.ok) {
                let errMsg = '请求失败';
                try {
                    const err = await resp.json();
                    errMsg = err.error || err.message || errMsg;
                } catch (_) {
                    // 响应体不是 JSON（如 HTML 错误页），使用状态码 + 状态文本
                    const text = await resp.text().catch(() => '');
                    errMsg = `HTTP ${resp.status}${resp.statusText ? ' ' + resp.statusText : ''}${text ? ': ' + text.substring(0, 200) : ''}`;
                }
                removeTypingIndicator(bubbleEl);
                bubbleEl.innerHTML = renderChatMarkdown(errMsg);
                if (resp.status === 401 || resp.status === 403) {
                    _aiKeyValidated = false;
                    updateApiStatus();
                }
                aiIsStreaming = false;
                updateSendButton();
                return;
            }

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let assistantText = '';
            let typingRemoved = false;
            let needNewBubble = false;
            let currentBubble = bubbleEl;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        var currentEvent = line.substring(7).trim();
                    } else if (line.startsWith('data: ') && currentEvent) {
                        let eventData;
                        try {
                            eventData = JSON.parse(line.substring(6));
                        } catch { continue; }

                        if (!typingRemoved && currentEvent !== 'conversation_id') {
                            removeTypingIndicator(currentBubble);
                            typingRemoved = true;
                        }

                        switch (currentEvent) {
                            case 'conversation_id':
                                aiConversationId = eventData.id;
                                break;

                            case 'progress':
                                if (!typingRemoved) {
                                    removeTypingIndicator(currentBubble);
                                    typingRemoved = true;
                                }
                                addProgressStep(eventData.message, eventData.phase);
                                break;

                            case 'reasoning': {
                                if (!typingRemoved) {
                                    removeTypingIndicator(currentBubble);
                                    typingRemoved = true;
                                }
                                // 确保推理面板存在
                                let reasoningEl = assistantEl.querySelector('.ai-reasoning');
                                if (!reasoningEl) {
                                    reasoningEl = document.createElement('div');
                                    reasoningEl.className = 'ai-reasoning';
                                    reasoningEl.innerHTML = `
                                        <button class="ai-reasoning-toggle">
                                            <svg class="ai-reasoning-chevron" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                                <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
                                            </svg>
                                            <span>${t('reasoning_title')}</span>
                                        </button>
                                        <div class="ai-reasoning-content"></div>
                                    `;
                                    reasoningEl.querySelector('.ai-reasoning-toggle').addEventListener('click', function () {
                                        const content = this.nextElementSibling;
                                        const chevron = this.querySelector('.ai-reasoning-chevron');
                                        content.classList.toggle('show');
                                        chevron.classList.toggle('expanded');
                                    });
                                    // 插入到第一条消息气泡之前
                                    const firstBubble = assistantEl.querySelector('.ai-msg-bubble');
                                    if (firstBubble) {
                                        assistantEl.insertBefore(reasoningEl, firstBubble);
                                    } else {
                                        assistantEl.appendChild(reasoningEl);
                                    }
                                }
                                const reasoningContent = reasoningEl.querySelector('.ai-reasoning-content');
                                reasoningContent.textContent += eventData.content;
                                scrollToBottom();
                                break;
                            }

                            case 'token':
                                if (needNewBubble) {
                                    currentBubble = document.createElement('div');
                                    currentBubble.className = 'ai-msg-bubble';
                                    assistantEl.appendChild(currentBubble);
                                    assistantText = '';
                                    needNewBubble = false;
                                }
                                if (!typingRemoved) {
                                    removeTypingIndicator(currentBubble);
                                    typingRemoved = true;
                                }
                                assistantText += eventData.content;
                                currentBubble.innerHTML = renderChatMarkdown(assistantText);
                                scrollToBottom();
                                break;

                            case 'tool_call': {
                                if (!assistantText.trim() && currentBubble && currentBubble.parentNode) {
                                    currentBubble.remove();
                                }
                                needNewBubble = true;
                                const card = appendToolCard(
                                    eventData.call_id,
                                    eventData.name,
                                    eventData.args,
                                    null,
                                    eventData.backup_group_id,
                                    assistantEl
                                );
                                scrollToBottom();
                                break;
                            }

                            case 'tool_result': {
                                updateToolCard(
                                    eventData.name,
                                    eventData.result,
                                    eventData.backup_info,
                                    eventData.backup_group_id || null,
                                    eventData.call_id,
                                    eventData.args
                                );
                                scrollToBottom();
                                break;
                            }

                            case 'error':
                                if (eventData.message && (eventData.message.includes('401') || eventData.message.includes('403') || eventData.message.includes('认证') || eventData.message.includes('auth') || eventData.message.includes('无效'))) {
                                    _aiKeyValidated = false;
                                    updateApiStatus();
                                }
                                if (needNewBubble) {
                                    currentBubble = document.createElement('div');
                                    currentBubble.className = 'ai-msg-bubble';
                                    assistantEl.appendChild(currentBubble);
                                    needNewBubble = false;
                                }
                                if (!assistantText) {
                                    currentBubble.innerHTML = `<span style="color:var(--danger-color)">${escapeHtml(eventData.message)}</span>`;
                                } else {
                                    currentBubble.innerHTML = renderChatMarkdown(assistantText) +
                                        `<p style="color:var(--danger-color);margin-top:8px">${escapeHtml(eventData.message)}</p>`;
                                }
                                break;

                            case 'title_generated':
                                break;

                            case 'done':
                                break;
                        }
                        currentEvent = null;
                    }
                }
            }

            if (!typingRemoved) {
                removeTypingIndicator(currentBubble);
            }
            if (needNewBubble && !assistantText) {
                // tool calls handled but no subsequent text — that's OK
            } else if (!assistantText && currentBubble && currentBubble.parentNode && currentBubble.textContent.trim() === '') {
                currentBubble.innerHTML = '<span style="color:var(--text-secondary)">' + t('no_reply') + '</span>';
            }

            // 完成进度卡片
            completeProgressCard();

        } catch (e) {
            const activeBubble = assistantEl.querySelector('.ai-msg-bubble:last-of-type') || bubbleEl;
            if (e.name === 'AbortError') {
                if (activeBubble.querySelector('.ai-typing')) {
                    removeTypingIndicator(activeBubble);
                }
                if (assistantText) {
                    activeBubble.innerHTML = renderChatMarkdown(assistantText);
                }
                activeBubble.innerHTML += '<p style="color:var(--text-secondary);font-size:12px;margin-top:6px">' + t('stopped') + '</p>';
                if (aiConversationId && assistantText) {
                    try {
                        await fetch(`/api/ai/conversations/${aiConversationId}/save-partial`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ content: assistantText })
                        });
                    } catch (_) {}
                }
            } else {
                removeTypingIndicator(activeBubble);
                activeBubble.innerHTML = `<span style="color:var(--danger-color)">${t('connection_error')}${escapeHtml(e.message)}</span>`;
            }
            completeProgressCard();
        } finally {
            aiIsStreaming = false;
            aiAbortController = null;
            updateSendButton();
            scrollToBottom();
            // 渲染 Mermaid 图表（流式完成/中断后）
            renderMermaidInChat();
            if (typeof loadLibrary === 'function') {
                setTimeout(() => loadLibrary(currentPath), 500);
            }
        }
    }

    function stopStreaming() {
        if (aiAbortController) {
            aiAbortController.abort();
        }
    }

    function updateSendButton() {
        const wrapper = aiSendBtn.parentElement;
        if (aiIsStreaming) {
            aiSendBtn.style.display = 'none';
            let stopBtn = wrapper.querySelector('.ai-stop-btn');
            if (!stopBtn) {
                stopBtn = document.createElement('button');
                stopBtn.className = 'ai-stop-btn';
                stopBtn.title = t('stop_generating');
                stopBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="3" width="10" height="10" rx="1"/></svg>';
                stopBtn.addEventListener('click', stopStreaming);
                wrapper.appendChild(stopBtn);
            }
            stopBtn.style.display = 'flex';
        } else {
            aiSendBtn.style.display = 'flex';
            const stopBtn = wrapper.querySelector('.ai-stop-btn');
            if (stopBtn) stopBtn.style.display = 'none';
        }
    }

    // --- 进度卡片 ---
    let aiProgressCard = null;
    let aiProgressSteps = [];  // {id, message, status: 'running'|'done'|'error'}
    let aiProgressStepIndex = 0;

    function createProgressCard(parentEl) {
        // 移除旧的进度卡片
        if (aiProgressCard && aiProgressCard.parentNode) {
            aiProgressCard.remove();
        }
        aiProgressSteps = [];
        aiProgressStepIndex = 0;

        const card = document.createElement('div');
        card.className = 'ai-progress-card';
        card.innerHTML = `
            <div class="ai-progress-card-header">
                <div class="ai-progress-card-title">
                    <span class="ai-progress-card-icon">
                        <span class="ai-tool-spinner"></span>
                    </span>
                    <span>${t('ai_progress_title')}</span>
                </div>
                <svg class="ai-progress-chevron" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
                </svg>
            </div>
            <div class="ai-progress-card-body">
                <div class="ai-progress-steps"></div>
            </div>
        `;

        card.querySelector('.ai-progress-card-header').addEventListener('click', function () {
            const body = card.querySelector('.ai-progress-card-body');
            body.classList.toggle('collapsed');
            card.querySelector('.ai-progress-chevron').classList.toggle('expanded');
        });

        if (parentEl) {
            parentEl.insertBefore(card, parentEl.firstChild);
        } else {
            aiMessages.appendChild(card);
        }

        aiProgressCard = card;
        return card;
    }

    function addProgressStep(message, phase) {
        if (!aiProgressCard) return;

        // 更新上一个同 phase 的步骤为完成（如果有）
        for (let i = aiProgressSteps.length - 1; i >= 0; i--) {
            if (aiProgressSteps[i].status === 'running') {
                aiProgressSteps[i].status = 'done';
                const stepEl = aiProgressCard.querySelector(`.ai-progress-step[data-step-id="${aiProgressSteps[i].id}"]`);
                if (stepEl) {
                    const iconEl = stepEl.querySelector('.ai-progress-step-icon');
                    if (iconEl) {
                        iconEl.innerHTML = '<span class="ai-progress-check">&#10003;</span>';
                    }
                    stepEl.classList.add('done');
                }
                break;
            }
        }

        const stepId = 'ps_' + (aiProgressStepIndex++);
        aiProgressSteps.push({ id: stepId, message: message, status: 'running' });

        const stepsEl = aiProgressCard.querySelector('.ai-progress-steps');
        const stepEl = document.createElement('div');
        stepEl.className = 'ai-progress-step running';
        stepEl.dataset.stepId = stepId;
        stepEl.innerHTML = `
            <span class="ai-progress-step-icon">
                <span class="ai-tool-spinner"></span>
            </span>
            <span class="ai-progress-step-text">${escapeHtml(message)}</span>
        `;
        stepsEl.appendChild(stepEl);

        // 自动滚动步骤列表
        stepsEl.scrollTop = stepsEl.scrollHeight;

        // 更新标题栏状态
        updateProgressCardTitle();
    }

    function updateProgressCardTitle() {
        if (!aiProgressCard) return;
        const runningSteps = aiProgressSteps.filter(s => s.status === 'running');
        if (runningSteps.length > 0) {
            const titleEl = aiProgressCard.querySelector('.ai-progress-card-title span:last-child');
            if (titleEl) {
                titleEl.textContent = runningSteps[runningSteps.length - 1].message;
            }
        }
    }

    function completeProgressCard() {
        if (!aiProgressCard) return;

        // 将所有运行中的步骤标记为完成
        for (const step of aiProgressSteps) {
            if (step.status === 'running') {
                step.status = 'done';
                const stepEl = aiProgressCard.querySelector(`.ai-progress-step[data-step-id="${step.id}"]`);
                if (stepEl) {
                    const iconEl = stepEl.querySelector('.ai-progress-step-icon');
                    if (iconEl) {
                        iconEl.innerHTML = '<span class="ai-progress-check">&#10003;</span>';
                    }
                    stepEl.classList.remove('running');
                    stepEl.classList.add('done');
                }
            }
        }

        // 更新标题栏图标和状态
        const titleIcon = aiProgressCard.querySelector('.ai-progress-card-icon');
        if (titleIcon) {
            titleIcon.innerHTML = '<span class="ai-progress-check">&#10003;</span>';
        }
        const titleText = aiProgressCard.querySelector('.ai-progress-card-title span:last-child');
        if (titleText) {
            titleText.textContent = t('ai_progress_done');
        }
        aiProgressCard.classList.add('completed');

        // 1.5秒后自动折叠
        setTimeout(() => {
            if (aiProgressCard && aiProgressCard.parentNode) {
                const body = aiProgressCard.querySelector('.ai-progress-card-body');
                const chevron = aiProgressCard.querySelector('.ai-progress-chevron');
                if (body && !body.classList.contains('collapsed')) {
                    body.classList.add('collapsed');
                    if (chevron) chevron.classList.remove('expanded');
                }
            }
        }, 1500);
    }

    // --- DOM 操作 ---
    function appendMessage(role, content) {
        const div = document.createElement('div');
        div.className = `ai-msg ${role}`;
        const bubble = document.createElement('div');
        bubble.className = 'ai-msg-bubble';
        if (role === 'user') {
            bubble.textContent = content;
            div.dataset.userMsgIndex = userMsgCounter;
            div.dataset.userMsgContent = content;
            userMsgCounter++;

            div.appendChild(bubble);

            const actions = document.createElement('div');
            actions.className = 'ai-msg-actions';
            actions.innerHTML = `
                <button class="ai-msg-action-btn ai-msg-edit-btn" title="${t('edit_msg')}">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zM13.5 6.207L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5z"/>
                        <path d="M6.032 13.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"/>
                    </svg>
                </button>
                <button class="ai-msg-action-btn ai-msg-rollback-btn" title="${t('rollback_msg')}">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                        <path fill-rule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/>
                        <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/>
                    </svg>
                </button>
            `;
            actions.querySelector('.ai-msg-edit-btn').addEventListener('click', () => handleEditMessage(div));
            actions.querySelector('.ai-msg-rollback-btn').addEventListener('click', () => handleRollbackMessage(div));
            div.appendChild(actions);
        } else {
            bubble.innerHTML = content ? renderChatMarkdown(content) : '';
            div.appendChild(bubble);
            // 渲染 Mermaid 图表
            renderMermaidInChat();
        }
        aiMessages.appendChild(div);
        scrollToBottom();
        return div;
    }

    function showTypingIndicator(bubble) {
        bubble.innerHTML = `<div class="ai-typing"><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div></div>`;
    }

    function removeTypingIndicator(bubble) {
        const typing = bubble.querySelector('.ai-typing');
        if (typing) typing.remove();
    }

    function getToolDescription(name, args) {
        switch (name) {
            case 'read_file': {
                let d = t('tool_read', {path: args.path || ''});
                if (args.start_line || args.end_line)
                    d += t('tool_read_range', {start: args.start_line || 1, end: args.end_line || '∞'});
                return d;
            }
            case 'write_file': return t('tool_write', {path: args.path || ''});
            case 'edit_file': return t('tool_edit', {path: args.path || ''});
            case 'create_file': return t('tool_create', {path: args.path || ''});
            case 'create_folder': return t('tool_create_folder', {path: args.path || ''});
            case 'delete_item': return t('tool_delete', {path: args.path || ''});
            case 'move_item': return t('tool_move', {source: args.source || '', target: args.target || ''});
            case 'list_directory': return t('tool_list', {path: args.path || t('root_dir')});
            case 'search_files': return t('tool_search', {query: args.query || ''});
            case 'web_search': return t('tool_web_search', {query: args.query || ''});
            case 'fetch_url': return t('tool_fetch', {url: args.url || ''});
            default: return name;
        }
    }

    function appendToolCard(callId, name, args, result, backupGroupId, parentEl) {
        const card = document.createElement('div');
        card.className = 'ai-tool-card';
        card.dataset.callId = callId;
        card.dataset.toolName = name;

        const desc = getToolDescription(name, args);

        card.innerHTML = `
            <div class="ai-tool-card-header">
                <div class="ai-tool-spinner"></div>
                <span class="ai-tool-desc">${escapeHtml(desc)}</span>
                <svg class="ai-tool-chevron" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
                </svg>
            </div>
            <div class="ai-tool-card-body">
                <div class="ai-tool-executing-hint"><div class="ai-tool-spinner"></div> ${t('executing')}</div>
                <pre class="ai-tool-output" style="display:none"></pre>
            </div>
        `;

        card.querySelector('.ai-tool-card-header').addEventListener('click', function () {
            card.querySelector('.ai-tool-card-body').classList.toggle('show');
            card.querySelector('.ai-tool-chevron').classList.toggle('expanded');
        });

        if (parentEl) {
            parentEl.appendChild(card);
        } else {
            aiMessages.appendChild(card);
        }
        return card;
    }

    function updateToolCard(name, result, backupInfo, backupGroupId, callId, args) {
        let card;
        if (callId) {
            card = aiMessages.querySelector(`.ai-tool-card[data-call-id="${callId}"]`);
        }
        if (!card) {
            const cards = aiMessages.querySelectorAll('.ai-tool-card');
            card = cards[cards.length - 1];
        }
        if (!card) return;

        if (args && Object.keys(args).length > 0) {
            const descEl = card.querySelector('.ai-tool-desc');
            if (descEl) descEl.textContent = getToolDescription(name, args);
        }

        const spinner = card.querySelector('.ai-tool-card-header .ai-tool-spinner');
        if (spinner) {
            spinner.outerHTML = '<span class="ai-tool-check">\u2713</span>';
        }
        card.classList.add('completed');

        const hint = card.querySelector('.ai-tool-executing-hint');
        if (hint) hint.remove();

        const output = card.querySelector('.ai-tool-output');
        if (output && result) {
            output.style.display = 'block';
            output.textContent = result;
        }

        if (backupInfo && backupGroupId) {
            const body = card.querySelector('.ai-tool-card-body');
            const btn = document.createElement('button');
            btn.className = 'ai-tool-rollback-btn';
            btn.textContent = t('rollback_op');
            btn.addEventListener('click', async () => {
                if (!confirm(t('rollback_op_confirm', {type: backupInfo.type, path: backupInfo.path}))) return;
                btn.disabled = true;
                btn.textContent = t('rolling_back');
                try {
                    const resp = await fetch('/api/ai/rollback', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ backup_group_id: backupGroupId })
                    });
                    const data = await resp.json();
                    if (data.success) {
                        btn.textContent = t('rolled_back');
                        btn.style.borderColor = 'var(--success-color)';
                        btn.style.color = 'var(--success-color)';
                        if (typeof loadLibrary === 'function') {
                            loadLibrary(currentPath);
                        }
                        if (typeof selectedFile !== 'undefined' && selectedFile) {
                            setTimeout(() => {
                                if (typeof previewFile === 'function') previewFile(selectedFile);
                            }, 300);
                        }
                    } else {
                        btn.textContent = t('rollback_failed') + data.message;
                        btn.disabled = false;
                    }
                } catch (e) {
                    btn.textContent = t('rollback_error');
                    btn.disabled = false;
                }
            });
            body.appendChild(btn);
        }
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            aiMessages.scrollTop = aiMessages.scrollHeight;
        });
    }

    function autoResizeInput() {
        aiInput.style.height = '22px';
        aiInput.style.height = Math.min(aiInput.scrollHeight, 120) + 'px';
    }

    // --- Markdown 渲染（使用 marked.js） ---
    function renderChatMarkdown(text) {
        if (!text) return '';

        // 使用 marked.js 进行完整的 Markdown 渲染
        if (typeof marked !== 'undefined') {
            try {
                return marked.parse(text);
            } catch (e) {
                console.error('Markdown 解析错误:', e);
            }
        }

        // 降级方案：基础 HTML 转义 + 换行
        return '<p>' + escapeHtml(text).replace(/\n/g, '<br>') + '</p>';
    }

    // --- Mermaid 图表渲染 ---
    async function renderMermaidInChat() {
        if (!window.mermaid) return;

        const mermaidBlocks = aiMessages.querySelectorAll('pre code.language-mermaid');
        if (mermaidBlocks.length === 0) return;

        // 过滤掉已处理的块
        const unprocessed = [];
        for (const codeBlock of mermaidBlocks) {
            const pre = codeBlock.parentElement;
            if (pre.classList.contains('mermaid-processed')) continue;
            pre.classList.add('mermaid-processed');
            const mermaidCode = codeBlock.textContent.trim();
            if (mermaidCode) {
                unprocessed.push({ pre, mermaidCode });
            }
        }
        if (unprocessed.length === 0) return;

        // 初始化 mermaid - 使用统一配置
        try {
            mermaid.initialize(
                window.MERMAID_CONFIG || {
                    startOnLoad: false,
                    theme: 'default',
                    securityLevel: 'loose',
                    suppressErrorRendering: false,
                    fontFamily: 'Arial, sans-serif',
                    logLevel: 'error',
                    flowchart: { useMaxWidth: true, htmlLabels: true }
                }
            );
        } catch (err) {
            console.error('Mermaid 初始化失败:', err);
            // 恢复标记，允许下次重试
            for (const { pre } of unprocessed) {
                pre.classList.remove('mermaid-processed');
            }
            return;
        }

        // 第一步：创建容器并替换所有 <pre> 元素
        const renderTasks = [];
        for (let i = 0; i < unprocessed.length; i++) {
            const { pre, mermaidCode } = unprocessed[i];

            const container = document.createElement('div');
            container.className = 'ai-mermaid-container';
            container.setAttribute('data-mermaid-source', mermaidCode);

            const mermaidDiv = document.createElement('div');
            mermaidDiv.className = 'mermaid';
            container.appendChild(mermaidDiv);

            // 右上角工具栏：放大查看按钮
            const actions = document.createElement('div');
            actions.className = 'ai-mermaid-actions';
            const zoomBtn = document.createElement('button');
            zoomBtn.type = 'button';
            zoomBtn.className = 'ai-mermaid-btn';
            zoomBtn.title = '放大查看';
            zoomBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM13 6.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z"/><path d="M10.344 11.742c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1 6.538 6.538 0 0 1-1.398 1.4z"/><path fill-rule="evenodd" d="M6.5 3a.5.5 0 0 1 .5.5V6h2.5a.5.5 0 0 1 0 1H7v2.5a.5.5 0 0 1-1 0V7H3.5a.5.5 0 0 1 0-1H6V3.5a.5.5 0 0 1 .5-.5z"/></svg>';
            zoomBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof window.openMermaidZoomModal === 'function') {
                    window.openMermaidZoomModal(container);
                }
            });
            actions.appendChild(zoomBtn);
            container.appendChild(actions);

            // 在渲染前先替换 DOM 元素
            pre.replaceWith(container);

            renderTasks.push({ container, mermaidDiv, mermaidCode, index: i });
        }

        // 第二步：逐个渲染 Mermaid 图表
        for (const task of renderTasks) {
            const { container, mermaidDiv, mermaidCode, index } = task;
            const id = `ai-mermaid-${Date.now()}-${index}`;

            try {
                const { svg } = await mermaid.render(id, mermaidCode);
                mermaidDiv.innerHTML = svg;
            } catch (err) {
                console.error(`Mermaid 图表 ${index + 1} 渲染失败:`, err);
                // 显示友好的错误提示，同时保留原始代码供用户查看
                mermaidDiv.innerHTML =
                    `<div style="padding:12px;background:#fff3f3;border:1px solid #f88;border-radius:6px;color:#c33;font-size:13px;max-width:100%;overflow:auto;">
                        <strong>Mermaid 图表渲染失败</strong><br><br>
                        <strong>错误信息：</strong>${escapeHtml(err.message || '未知错误')}<br><br>
                        <details style="margin-top:8px;">
                            <summary style="cursor:pointer;color:#666;">查看源代码</summary>
                            <pre style="margin-top:8px;padding:8px;background:#fafafa;border:1px solid #ddd;border-radius:4px;font-size:12px;overflow:auto;">${escapeHtml(mermaidCode)}</pre>
                        </details>
                    </div>`;
            }
        }
    }

    // --- 工具函数 ---
    function escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    function formatRelativeTime(iso) {
        if (!iso) return '';
        const diff = Date.now() - new Date(iso).getTime();
        if (diff < 60000) return t('just_now');
        if (diff < 3600000) return t('minutes_ago', {n: Math.floor(diff / 60000)});
        if (diff < 86400000) return t('hours_ago', {n: Math.floor(diff / 3600000)});
        if (diff < 604800000) return t('days_ago', {n: Math.floor(diff / 86400000)});
        const lang = localStorage.getItem('appLanguage') || 'zh-CN';
        return new Date(iso).toLocaleDateString(lang);
    }

    // --- 拖拽调整面板宽度 ---
    function initResizeHandles() {
        const libPanel = document.querySelector('.library-panel');
        const aiPanelEl = document.querySelector('.ai-panel');

        const libHandle = document.createElement('div');
        libHandle.className = 'resize-handle';
        libPanel.appendChild(libHandle);
        makeResizable(libHandle, 'library');

        const aiHandle = document.createElement('div');
        aiHandle.className = 'resize-handle';
        aiPanelEl.appendChild(aiHandle);
        makeResizable(aiHandle, 'ai');
    }

    function makeResizable(handle, panel) {
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const container = document.querySelector('.app-container');
            const startX = e.clientX;
            const panelEl = panel === 'library'
                ? container.querySelector('.library-panel')
                : container.querySelector('.ai-panel');
            const startWidth = panelEl.getBoundingClientRect().width;

            handle.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            container.style.transition = 'none';

            const onMove = (ev) => {
                const diff = ev.clientX - startX;
                let newWidth;
                if (panel === 'library') {
                    newWidth = Math.max(200, Math.min(600, startWidth + diff));
                    document.documentElement.style.setProperty('--lib-panel-width', newWidth + 'px');
                    localStorage.setItem('libPanelWidth', newWidth);
                } else {
                    newWidth = Math.max(300, Math.min(700, startWidth - diff));
                    document.documentElement.style.setProperty('--ai-panel-width', newWidth + 'px');
                    localStorage.setItem('aiPanelWidth', newWidth);
                }
            };

            const onUp = () => {
                handle.classList.remove('dragging');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                container.style.transition = '';
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    function restorePanelSizes() {
        const libW = localStorage.getItem('libPanelWidth');
        const aiW = localStorage.getItem('aiPanelWidth');
        if (libW) document.documentElement.style.setProperty('--lib-panel-width', libW + 'px');
        if (aiW) document.documentElement.style.setProperty('--ai-panel-width', aiW + 'px');
    }

    // --- 启动 ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAI);
    } else {
        initAI();
    }
})();
