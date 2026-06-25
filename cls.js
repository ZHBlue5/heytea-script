// ==UserScript==
// @name CLS Topic 快速切换
// @namespace http://tampermonkey.net/
// @version 1.0.1
// @description 腾讯云 CLS 日志检索页快速切换 topic_id（可拖动隐藏、Topic 可管理）
// @match https://console.cloud.tencent.com/cls/search*
// @grant none
// @run-at document-end
// ==/UserScript==



(function () {
    'use strict';

    const DEFAULT_TOPICS = [
        { name: '广州-测试环境', topicId: 'bf887d9e-0cdc-42f5-8a8f-89c29990c756', region: 'ap-guangzhou' }
    ];

    const REGION_PRESETS = ['ap-guangzhou', 'ap-shanghai', 'ap-beijing', 'ap-nanjing', 'ap-hongkong'];

    const UI_STATE_KEY = 'cls-ui-state';
    const TOPICS_KEY = 'cls-topics';
    const EDGE_THRESHOLD = 20;
    const BTN_SIZE = 48;
    const TOOLBAR_ZONE = 34;
    const TAB_HIT_W = 32;
    const TAB_HIT_H = 80;
    const TAB_VIS_W = 16;
    const TAB_VIS_H = 64;

    // ========== 样式 ==========
    const STYLE = `
.cls-wrap {
    position: fixed;
    z-index: 99999;
    width: ${BTN_SIZE}px;
    height: ${BTN_SIZE}px;
    overflow: visible;
    pointer-events: none;
    box-sizing: border-box;
}
.cls-wrap:not(.collapsed) {
    padding-left: ${TOOLBAR_ZONE}px;
    margin-left: -${TOOLBAR_ZONE}px;
    width: calc(${BTN_SIZE}px + ${TOOLBAR_ZONE}px);
    pointer-events: auto;
}
.cls-wrap .cls-panel,
.cls-wrap .cls-tab {
    pointer-events: auto;
}
.cls-wrap.collapsed {
    padding-left: 0 !important;
    margin-left: 0 !important;
    width: ${TAB_HIT_W}px !important;
    height: ${TAB_HIT_H}px !important;
    display: flex;
    align-items: center;
    justify-content: center;
}
.cls-wrap.collapsed .cls-panel { display: none; }
.cls-wrap.collapsed .cls-tab { display: flex; }

.cls-tab {
    display: none;
    align-items: center;
    justify-content: center;
    width: ${TAB_VIS_W}px;
    height: ${TAB_VIS_H}px;
    background: #006EFF;
    border-radius: 10px;
    cursor: pointer;
    box-shadow: 0 2px 12px rgba(0,122,255,0.45);
    color: #fff;
    font-size: 18px;
    font-weight: 600;
    line-height: 1;
    user-select: none;
    transition: width 0.12s, height 0.12s, filter 0.12s;
    flex-shrink: 0;
}
.cls-tab:hover {
    filter: brightness(1.12);
    box-shadow: 0 2px 16px rgba(0,122,255,0.55);
}
.cls-wrap.collapsed.edge-right .cls-tab {
    border-radius: 10px 0 0 10px;
    margin-left: auto;
}
.cls-wrap.collapsed.edge-right .cls-tab:hover { width: ${TAB_VIS_W + 4}px; }
.cls-wrap.collapsed.edge-left .cls-tab {
    border-radius: 0 10px 10px 0;
    margin-right: auto;
}
.cls-wrap.collapsed.edge-left .cls-tab:hover { width: ${TAB_VIS_W + 4}px; }
.cls-wrap.collapsed.edge-top .cls-tab {
    border-radius: 0 0 10px 10px;
    width: ${TAB_VIS_H}px;
    height: ${TAB_VIS_W}px;
    margin-bottom: auto;
}
.cls-wrap.collapsed.edge-top .cls-tab:hover { height: ${TAB_VIS_W + 4}px; }
.cls-wrap.collapsed.edge-bottom .cls-tab {
    border-radius: 10px 10px 0 0;
    width: ${TAB_VIS_H}px;
    height: ${TAB_VIS_W}px;
    margin-top: auto;
}
.cls-wrap.collapsed.edge-bottom .cls-tab:hover { height: ${TAB_VIS_W + 4}px; }

.cls-panel {
    position: relative;
    width: ${BTN_SIZE}px;
    height: ${BTN_SIZE}px;
    overflow: visible;
}

/* 隔离腾讯云控制台对悬浮按钮的全局样式 */
.cls-wrap button,
.cls-panel button {
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
    text-transform: none !important;
    letter-spacing: normal !important;
    -webkit-appearance: none !important;
    appearance: none !important;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif !important;
    line-height: 1 !important;
    min-height: 0 !important;
    max-width: none !important;
    box-sizing: border-box !important;
}

.cls-toolbar {
    position: absolute;
    right: calc(100% + 4px);
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 4px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.12s;
    z-index: 5;
}
.cls-wrap.toolbar-show .cls-toolbar {
    opacity: 1;
    pointer-events: auto;
}
.cls-wrap.menu-open .cls-toolbar { opacity: 0 !important; pointer-events: none !important; }

.cls-drag-handle,
.cls-hide-btn {
    display: flex !important;
    align-items: center;
    justify-content: center;
    width: 22px !important;
    height: 22px !important;
    min-width: 22px !important;
    max-width: 22px !important;
    min-height: 22px !important;
    max-height: 22px !important;
    border-radius: 11px !important;
    background: rgba(30,30,30,0.88) !important;
    color: #fff !important;
    cursor: pointer;
    flex-shrink: 0;
    padding: 0 !important;
    overflow: hidden !important;
}
.cls-drag-handle { cursor: grab; }
.cls-drag-handle:active { cursor: grabbing; }
.cls-drag-handle svg,
.cls-hide-btn svg { display: block; pointer-events: none; }
.cls-hide-btn:hover { background: rgba(255,59,48,0.9) !important; }
.cls-drag-handle:hover { background: rgba(50,50,50,0.92) !important; }

.cls-btn {
    position: relative;
    width: ${BTN_SIZE}px;
    height: ${BTN_SIZE}px;
    border-radius: 24px;
    background: #006EFF !important;
    border: none;
    box-shadow: 0 4px 12px rgba(0,122,255,0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    z-index: 1;
}
.cls-btn:hover { filter: brightness(1.08); }
.cls-btn:active { filter: brightness(0.95); }
.cls-btn svg { width: 22px; height: 22px; fill: white; pointer-events: none; }

.cls-wrap.menu-open .cls-hide-btn { display: none !important; }

.cls-menu {
    position: fixed;
    z-index: 100000;
    width: 260px;
    min-width: 240px;
    max-width: 300px;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.18);
    display: none;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: normal;
    text-align: left;
    box-sizing: border-box;
}
.cls-menu.show { display: flex; }

/* 隔离腾讯云控制台全局 button/input 样式 */
.cls-menu button {
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    background: transparent !important;
    box-shadow: none !important;
    text-transform: none !important;
    letter-spacing: normal !important;
    -webkit-appearance: none !important;
    appearance: none !important;
    font-family: inherit !important;
    line-height: 1 !important;
    min-height: 0 !important;
    max-width: none !important;
}
.cls-menu button:focus { outline: none !important; }

.cls-menu-list {
    overflow-y: auto;
    flex: 1 1 auto;
    min-height: 0;
    overscroll-behavior: contain;
}

.cls-section-label {
    padding: 6px 12px 4px;
    font-size: 11px;
    color: #86868b;
    background: #fafafa;
    border-bottom: 1px solid #f0f0f0;
}

.cls-item {
    display: flex;
    align-items: center;
    padding: 6px 6px 6px 2px;
    color: #1d1d1f;
    font-size: 14px;
    font-weight: 500;
    border-bottom: 1px solid #f0f0f0;
    gap: 2px;
    transition: background 0.12s;
}
.cls-item:last-child { border-bottom: none; }
.cls-item:hover { background: #f5f5f7; }
.cls-item.is-dragging { opacity: 0.4; }
.cls-item.is-drag-over { background: #e8f4ff; }

.cls-item-body { flex: 1; cursor: pointer; min-width: 0; padding: 4px 4px 4px 0; }
.cls-item-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cls-ns { font-size: 11px; color: #86868b; margin-top: 2px; font-weight: 400; }

.cls-item-drag {
    display: flex !important;
    align-items: center;
    justify-content: center;
    width: 28px !important;
    min-width: 28px !important;
    height: 40px !important;
    flex-shrink: 0;
    cursor: grab;
    color: #aeaeb2;
    border-radius: 4px;
    touch-action: none;
}
.cls-item-drag:hover { color: #636366; background: #ebebef !important; }
.cls-item-drag:active { cursor: grabbing; }
.cls-item-drag svg { display: block; pointer-events: none; }

.cls-item-actions {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 2px;
}

.cls-item-pin, .cls-item-del {
    display: flex !important;
    align-items: center;
    justify-content: center;
    width: 28px !important;
    min-width: 28px !important;
    height: 28px !important;
    border-radius: 6px;
    cursor: pointer;
    color: #86868b;
    flex-shrink: 0;
}
.cls-item-pin svg, .cls-item-del svg { display: block; pointer-events: none; }
.cls-item-pin:hover { color: #006EFF !important; background: rgba(0,122,255,0.1) !important; }
.cls-item-pin.pinned { color: #006EFF !important; }
.cls-item-del:hover { color: #ff3b30 !important; background: rgba(255,59,48,0.1) !important; }

.cls-menu-footer {
    display: flex;
    border-top: 1px solid #f0f0f0;
    flex-shrink: 0;
    min-height: 42px;
    background: #fff;
    border-radius: 0 0 12px 12px;
}
.cls-footer-btn {
    flex: 1;
    display: flex !important;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 12px 8px !important;
    background: #fafafa !important;
    font-size: 12px !important;
    cursor: pointer;
    color: #1d1d1f !important;
    height: auto !important;
    width: auto !important;
    white-space: nowrap;
}
.cls-footer-btn:hover { background: #f0f0f0; }
.cls-footer-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.cls-footer-btn + .cls-footer-btn { border-left: 1px solid #f0f0f0; }

.cls-form {
    padding: 12px;
    border-top: 1px solid #f0f0f0;
    background: #fafafa;
    flex-shrink: 0;
}
.cls-form label {
    display: block;
    font-size: 11px;
    color: #86868b;
    margin-bottom: 4px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}
.cls-form input, .cls-form select {
    width: 100%;
    padding: 6px 8px;
    margin-bottom: 8px;
    border: 1px solid #d2d2d7;
    border-radius: 6px;
    font-size: 13px;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}
.cls-form-actions { display: flex; gap: 8px; }
.cls-form-actions button {
    flex: 1;
    padding: 8px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
}
.cls-form-save { background: #006EFF; color: #fff; }
.cls-form-cancel { background: #e5e5ea; color: #1d1d1f; }
`;

    // ========== URL 工具 ==========
    function getCurrentTopicFromUrl() {
        const params = new URLSearchParams(location.search);
        return {
            topicId: params.get('topic_id') || '',
            region: params.get('region') || ''
        };
    }

    function isPageReady() {
        const { topicId, region } = getCurrentTopicFromUrl();
        return !!(topicId && region);
    }

    function buildTopicUrl(topicId, region) {
        const url = new URL(location.href);
        url.searchParams.set('topic_id', topicId);
        url.searchParams.set('region', region);
        return url.toString();
    }

    function genId() {
        return crypto.randomUUID ? crypto.randomUUID() : `cls-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function switchTopic(topicId, region) {
        const current = getCurrentTopicFromUrl();
        if (current.topicId === topicId && current.region === region) {
            closeMenu();
            return;
        }

        const newUrl = buildTopicUrl(topicId, region);
        console.log(`[CLS] 切换: ${region}/${topicId}`);

        closeMenu();

        // CLS 控制台不响应 pushState，且 pushState 后再 assign 同 URL 不会触发刷新
        // 直接使用 replace 导航，保留 time/queryBase64 等参数
        try {
            history.replaceState(null, '', newUrl);
        } catch (e) { /* 忽略 */ }
        location.replace(newUrl);
    }

    // ========== TopicStore ==========
    const TopicStore = {
        _topics: [],
        _storageOk: true,

        load() {
            try {
                const raw = localStorage.getItem(TOPICS_KEY);
                if (raw) {
                    const data = JSON.parse(raw);
                    if (Array.isArray(data.topics)) {
                        this._topics = data.topics;
                        return;
                    }
                }
            } catch (e) {
                console.warn('[CLS] topics 解析失败，使用种子数据', e);
            }
            this._seed();
        },

        _seed() {
            this._topics = DEFAULT_TOPICS.map((e, i) => ({
                id: genId(),
                name: e.name,
                topicId: e.topicId,
                region: e.region,
                pinned: false,
                order: i
            }));
            this.save();
        },

        save() {
            if (!this._storageOk) return;
            try {
                localStorage.setItem(TOPICS_KEY, JSON.stringify({ topics: this._topics }));
            } catch (e) {
                this._storageOk = false;
                console.warn('[CLS] localStorage 不可用，Topic 配置无法持久化');
            }
        },

        getSorted() {
            return [...this._topics].sort((a, b) => {
                if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                return a.order - b.order;
            });
        },

        exists(topicId, region) {
            return this._topics.some(e => e.topicId === topicId && e.region === region);
        },

        add(env) {
            const maxOrder = this._topics.reduce((m, e) => Math.max(m, e.order), -1);
            this._topics.push({ ...env, id: genId(), order: maxOrder + 1 });
            this.save();
        },

        remove(id) {
            this._topics = this._topics.filter(e => e.id !== id);
            this.save();
        },

        togglePin(id) {
            const env = this._topics.find(e => e.id === id);
            if (!env) return;
            env.pinned = !env.pinned;
            const group = this._topics.filter(e => e.pinned === env.pinned);
            const maxOrder = group.reduce((m, e) => Math.max(m, e.order), -1);
            env.order = maxOrder + 1;
            this.save();
        },

        reorder(dragId, targetId) {
            const sorted = this.getSorted();
            const dragIdx = sorted.findIndex(e => e.id === dragId);
            const targetIdx = sorted.findIndex(e => e.id === targetId);
            if (dragIdx < 0 || targetIdx < 0 || dragIdx === targetIdx) return;

            const dragEnv = this._topics.find(e => e.id === dragId);
            const targetEnv = this._topics.find(e => e.id === targetId);
            if (!dragEnv || !targetEnv || dragEnv.pinned !== targetEnv.pinned) return;

            const [moved] = sorted.splice(dragIdx, 1);
            sorted.splice(targetIdx, 0, moved);
            sorted.forEach((e, i) => {
                const env = this._topics.find(x => x.id === e.id);
                if (env) env.order = i;
            });
            this.save();
        }
    };

    // ========== UIState ==========
    const UIState = {
        x: 0,
        y: 0,
        hidden: false,
        edge: null,
        _storageOk: true,

        load() {
            this.x = window.innerWidth - 20 - BTN_SIZE;
            this.y = window.innerHeight - 20 - BTN_SIZE;
            try {
                const raw = localStorage.getItem(UI_STATE_KEY);
                if (!raw) return;
                const data = JSON.parse(raw);
                if (typeof data.x === 'number') this.x = data.x;
                if (typeof data.y === 'number') this.y = data.y;
                if (typeof data.hidden === 'boolean') this.hidden = data.hidden;
                if (data.edge) this.edge = data.edge;
            } catch (e) {
                console.warn('[CLS] ui-state 解析失败，使用默认位置');
            }
            this.clamp();
        },

        save() {
            if (!this._storageOk) return;
            try {
                localStorage.setItem(UI_STATE_KEY, JSON.stringify({
                    x: this.x, y: this.y, hidden: this.hidden, edge: this.edge
                }));
            } catch (e) {
                this._storageOk = false;
            }
        },

        clamp() {
            const maxX = Math.max(0, window.innerWidth - BTN_SIZE);
            const maxY = Math.max(0, window.innerHeight - BTN_SIZE);
            this.x = Math.min(Math.max(0, this.x), maxX);
            this.y = Math.min(Math.max(0, this.y), maxY);
        },

        nearestEdge(x, y) {
            const d = {
                left: x,
                right: window.innerWidth - x - BTN_SIZE,
                top: y,
                bottom: window.innerHeight - y - BTN_SIZE
            };
            return Object.entries(d).sort((a, b) => a[1] - b[1])[0][0];
        }
    };

    // ========== UI ==========
    let uiRefs = {};

    function updateTabAppearance() {
        const { wrap, tab } = uiRefs;
        if (!wrap || !tab) return;
        const edges = ['left', 'right', 'top', 'bottom'];
        edges.forEach(e => wrap.classList.remove(`edge-${e}`));
        if (UIState.hidden && UIState.edge) {
            wrap.classList.add(`edge-${UIState.edge}`);
            const icons = { left: '›', right: '‹', top: '˅', bottom: '˄' };
            tab.textContent = icons[UIState.edge] || '‹';
        }
    }

    function applyPosition() {
        const { wrap } = uiRefs;
        if (!wrap) return;

        UIState.clamp();

        if (UIState.hidden && UIState.edge) {
            wrap.classList.add('collapsed');
            updateTabAppearance();
            if (UIState.edge === 'right') {
                wrap.style.left = `${window.innerWidth - TAB_HIT_W}px`;
                wrap.style.top = `${Math.max(8, UIState.y + (BTN_SIZE - TAB_HIT_H) / 2)}px`;
                wrap.style.width = '';
                wrap.style.height = '';
            } else if (UIState.edge === 'left') {
                wrap.style.left = '0px';
                wrap.style.top = `${Math.max(8, UIState.y + (BTN_SIZE - TAB_HIT_H) / 2)}px`;
                wrap.style.width = '';
                wrap.style.height = '';
            } else if (UIState.edge === 'top') {
                wrap.style.left = `${Math.max(8, UIState.x + (BTN_SIZE - TAB_HIT_H) / 2)}px`;
                wrap.style.top = '0px';
                wrap.style.width = `${TAB_HIT_H}px`;
                wrap.style.height = `${TAB_HIT_W}px`;
            } else {
                wrap.style.left = `${Math.max(8, UIState.x + (BTN_SIZE - TAB_HIT_H) / 2)}px`;
                wrap.style.top = `${window.innerHeight - TAB_HIT_W}px`;
                wrap.style.width = `${TAB_HIT_H}px`;
                wrap.style.height = `${TAB_HIT_W}px`;
            }
        } else {
            wrap.classList.remove('collapsed');
            wrap.style.width = '';
            wrap.style.height = '';
            wrap.style.left = `${UIState.x}px`;
            wrap.style.top = `${UIState.y}px`;
            updateTabAppearance();
        }
    }

    const MENU_WIDTH = 260;
    const MENU_GAP = 8;
    const VIEWPORT_PAD = 8;

    function positionMenu() {
        const { btn, menu, listEl, footer, form, wrap } = uiRefs;
        if (!btn || !menu || !menu.classList.contains('show')) return;

        const btnRect = btn.getBoundingClientRect();
        const formVisible = form && form.style.display !== 'none';

        menu.style.width = `${MENU_WIDTH}px`;
        listEl.style.maxHeight = '';

        const footerH = footer?.offsetHeight || 42;
        const formH = formVisible ? (form?.offsetHeight || 0) : 0;
        const chromeH = footerH + formH;

        const spaceAbove = btnRect.top - VIEWPORT_PAD - MENU_GAP;
        const spaceBelow = window.innerHeight - btnRect.bottom - VIEWPORT_PAD - MENU_GAP;
        const openUp = spaceAbove >= spaceBelow;

        let avail = Math.min(openUp ? spaceAbove : spaceBelow, window.innerHeight - VIEWPORT_PAD * 2);
        listEl.style.maxHeight = `${Math.max(60, avail - chromeH)}px`;

        let menuH = menu.offsetHeight;
        let top;

        if (openUp) {
            top = btnRect.top - MENU_GAP - menuH;
            if (top < VIEWPORT_PAD) {
                top = VIEWPORT_PAD;
                listEl.style.maxHeight = `${Math.max(60, btnRect.top - MENU_GAP - VIEWPORT_PAD - chromeH)}px`;
                menuH = menu.offsetHeight;
            }
        } else {
            top = btnRect.bottom + MENU_GAP;
            const maxBottom = window.innerHeight - VIEWPORT_PAD;
            if (top + menuH > maxBottom) {
                listEl.style.maxHeight = `${Math.max(60, maxBottom - top - chromeH)}px`;
            }
        }

        let left = btnRect.right - MENU_WIDTH;
        left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - MENU_WIDTH - VIEWPORT_PAD));

        menu.style.left = `${left}px`;

        if (openUp) {
            menuH = menu.offsetHeight;
            top = btnRect.top - MENU_GAP - menuH;
            if (top < VIEWPORT_PAD) top = VIEWPORT_PAD;
        }
        menu.style.top = `${top}px`;

        if (wrap) wrap.classList.add('menu-open');
    }

    function closeMenu() {
        const { menu, wrap } = uiRefs;
        if (menu) menu.classList.remove('show');
        if (wrap) {
            wrap.classList.remove('menu-open');
            wrap.classList.remove('toolbar-show');
        }
    }

    function openMenu() {
        const { menu, wrap } = uiRefs;
        if (!menu || wrap?.classList.contains('collapsed')) return;
        menu.classList.add('show');
        updateFooterButtons();
        requestAnimationFrame(() => {
            positionMenu();
            requestAnimationFrame(() => positionMenu());
        });
    }

    function collapseToEdge(edge) {
        closeMenu();
        UIState.hidden = true;
        UIState.edge = edge;
        applyPosition();
        UIState.save();
    }

    function restoreFromCollapsed() {
        UIState.hidden = false;
        UIState.edge = null;
        applyPosition();
        UIState.save();
    }

    function setupToolbarHover() {
        const { wrap } = uiRefs;
        if (!wrap) return;
        let hideTimer = null;

        const show = () => {
            if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
            if (!wrap.classList.contains('collapsed') && !wrap.classList.contains('menu-open')) {
                wrap.classList.add('toolbar-show');
            }
        };

        const hide = () => {
            hideTimer = setTimeout(() => {
                wrap.classList.remove('toolbar-show');
                hideTimer = null;
            }, 280);
        };

        wrap.addEventListener('mouseenter', show);
        wrap.addEventListener('mouseleave', hide);
        wrap.addEventListener('focusin', show);
        wrap.addEventListener('focusout', (e) => {
            if (!wrap.contains(e.relatedTarget)) hide();
        });
    }

    function setupDrag() {
        const { wrap, handle } = uiRefs;
        if (!handle) return;

        let dragging = false;
        let startX, startY, origX, origY;

        const onMove = (e) => {
            if (!dragging) return;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            UIState.x = origX + clientX - startX;
            UIState.y = origY + clientY - startY;
            UIState.clamp();
            wrap.style.left = `${UIState.x}px`;
            wrap.style.top = `${UIState.y}px`;
            if (uiRefs.menu?.classList.contains('show')) positionMenu();
        };

        const onEnd = () => {
            if (!dragging) return;
            dragging = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);

            const dist = {
                left: UIState.x,
                right: window.innerWidth - UIState.x - BTN_SIZE,
                top: UIState.y,
                bottom: window.innerHeight - UIState.y - BTN_SIZE
            };
            const nearest = Object.entries(dist).sort((a, b) => a[1] - b[1])[0];
            if (nearest[1] < EDGE_THRESHOLD) {
                collapseToEdge(nearest[0]);
            } else {
                UIState.hidden = false;
                UIState.edge = null;
                UIState.save();
            }
        };

        const onStart = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (UIState.hidden) return;
            uiRefs.wrap?.classList.add('toolbar-show');
            dragging = true;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startX = clientX;
            startY = clientY;
            origX = UIState.x;
            origY = UIState.y;
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onEnd);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onEnd);
        };

        handle.addEventListener('mousedown', onStart);
        handle.addEventListener('touchstart', onStart, { passive: false });
    }

    function renderTopicList() {
        const { listEl } = uiRefs;
        if (!listEl) return;

        const sorted = TopicStore.getSorted();
        const pinned = sorted.filter(e => e.pinned);
        const normal = sorted.filter(e => !e.pinned);

        let html = '';
        if (pinned.length) {
            html += '<div class="cls-section-label">📌 置顶</div>';
            html += pinned.map(renderTopicItem).join('');
        }
        if (normal.length) {
            if (pinned.length) html += '<div class="cls-section-label">全部</div>';
            html += normal.map(renderTopicItem).join('');
        }
        if (!sorted.length) {
            html = '<div class="cls-section-label" style="text-align:center;padding:16px">暂无 Topic，请收藏或添加</div>';
        }
        listEl.innerHTML = html;
        bindTopicItemEvents();
        if (uiRefs.menu?.classList.contains('show')) requestAnimationFrame(() => positionMenu());
    }

    const ICON_GRIP = '<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="2" cy="2" r="1.4"/><circle cx="8" cy="2" r="1.4"/><circle cx="2" cy="7" r="1.4"/><circle cx="8" cy="7" r="1.4"/><circle cx="2" cy="12" r="1.4"/><circle cx="8" cy="12" r="1.4"/></svg>';
    const ICON_CLOSE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    const ICON_STAR = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
    const ICON_STAR_OUTLINE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
    const ICON_DEL = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';

    function renderTopicItem(e) {
        return `<div class="cls-item" data-id="${e.id}">
            <button type="button" class="cls-item-drag" draggable="true" title="拖动排序">${ICON_GRIP}</button>
            <div class="cls-item-body" data-topic-id="${e.topicId}" data-region="${e.region}">
                <div class="cls-item-name">${escapeHtml(e.name)}</div>
                <div class="cls-ns">${escapeHtml(e.region)}</div>
            </div>
            <div class="cls-item-actions">
                <button type="button" class="cls-item-pin${e.pinned ? ' pinned' : ''}" title="${e.pinned ? '取消置顶' : '置顶'}">${e.pinned ? ICON_STAR : ICON_STAR_OUTLINE}</button>
                <button type="button" class="cls-item-del" title="删除">${ICON_DEL}</button>
            </div>
        </div>`;
    }

    function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function bindTopicItemEvents() {
        const { listEl } = uiRefs;
        if (!listEl) return;

        listEl.querySelectorAll('.cls-item-body').forEach(el => {
            el.onclick = () => {
                switchTopic(el.dataset.topicId, el.dataset.region);
            };
        });

        listEl.querySelectorAll('.cls-item-pin').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = btn.closest('.cls-item')?.dataset.id;
                if (id) { TopicStore.togglePin(id); renderTopicList(); }
            };
        });

        listEl.querySelectorAll('.cls-item-del').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = btn.closest('.cls-item')?.dataset.id;
                if (id && confirm('确定删除该 Topic？')) {
                    TopicStore.remove(id);
                    renderTopicList();
                }
            };
        });

        setupTopicDragReorder();
    }

    function setupTopicDragReorder() {
        const { listEl } = uiRefs;
        let dragId = null;
        let dragEl = null;

        listEl.querySelectorAll('.cls-item-drag').forEach(handle => {
            handle.onmousedown = (e) => e.stopPropagation();
            handle.onclick = (e) => e.stopPropagation();
            handle.ondragstart = (e) => {
                dragEl = handle.closest('.cls-item');
                dragId = dragEl?.dataset.id;
                if (!dragId) return;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', dragId);
                requestAnimationFrame(() => dragEl?.classList.add('is-dragging'));
            };
            handle.ondragend = () => {
                dragEl?.classList.remove('is-dragging');
                listEl.querySelectorAll('.cls-item.is-drag-over').forEach(el => el.classList.remove('is-drag-over'));
                dragId = null;
                dragEl = null;
            };
        });

        listEl.querySelectorAll('.cls-item').forEach(item => {
            item.ondragover = (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (item.dataset.id !== dragId) item.classList.add('is-drag-over');
            };
            item.ondragleave = () => item.classList.remove('is-drag-over');
            item.ondrop = (e) => {
                e.preventDefault();
                item.classList.remove('is-drag-over');
                const targetId = item.dataset.id;
                if (dragId && targetId && dragId !== targetId) {
                    TopicStore.reorder(dragId, targetId);
                    renderTopicList();
                }
            };
        });
    }

    function updateFooterButtons() {
        const ready = isPageReady();
        if (uiRefs.favBtn) {
            uiRefs.favBtn.disabled = !ready;
            uiRefs.favBtn.title = ready ? '' : 'URL 中缺少 topic_id 或 region';
        }
        if (uiRefs.addBtn) {
            uiRefs.addBtn.disabled = false;
            uiRefs.addBtn.title = '';
        }
    }

    function bookmarkCurrent() {
        const { topicId, region } = getCurrentTopicFromUrl();
        if (!topicId || !region) {
            alert('无法读取当前 topic_id 或 region');
            return;
        }
        if (TopicStore.exists(topicId, region)) {
            alert('该 Topic 已存在');
            return;
        }

        const defaultName = `${region}/${topicId.slice(0, 8)}`;
        const name = prompt('Topic 名称', defaultName);
        if (!name) return;

        TopicStore.add({ name, topicId, region, pinned: false });
        renderTopicList();
    }

    function buildRegionSelectHtml(selected) {
        const opts = REGION_PRESETS.map(r =>
            `<option value="${r}"${r === selected ? ' selected' : ''}>${r}</option>`
        ).join('');
        const custom = selected && !REGION_PRESETS.includes(selected);
        return opts + `<option value="__custom__"${custom ? ' selected' : ''}>自定义...</option>`;
    }

    function toggleForm(show) {
        const { form, listEl, footer } = uiRefs;
        if (!form) return;
        form.style.display = show ? 'block' : 'none';
        if (listEl) listEl.style.display = show ? 'none' : '';
        if (footer) footer.style.display = show ? 'none' : 'flex';

        if (show) {
            const { region } = getCurrentTopicFromUrl();
            const regionSelect = form.querySelector('.cls-form-region');
            const regionCustom = form.querySelector('.cls-form-region-custom');
            regionSelect.innerHTML = buildRegionSelectHtml(region);
            const syncCustom = () => {
                const isCustom = regionSelect.value === '__custom__';
                regionCustom.style.display = isCustom ? 'block' : 'none';
                if (!isCustom) regionCustom.value = '';
            };
            regionSelect.onchange = syncCustom;
            syncCustom();
        }
        if (uiRefs.menu?.classList.contains('show')) requestAnimationFrame(() => positionMenu());
    }

    function saveForm() {
        const { form } = uiRefs;
        if (!form) return;

        const name = form.querySelector('.cls-form-name').value.trim();
        const topicId = form.querySelector('.cls-form-topic-id').value.trim();
        const regionSelect = form.querySelector('.cls-form-region');
        const regionCustom = form.querySelector('.cls-form-region-custom').value.trim();
        const region = regionSelect.value === '__custom__' ? regionCustom : regionSelect.value;

        if (!name || !topicId || !region) {
            alert('请填写完整信息');
            return;
        }
        if (TopicStore.exists(topicId, region)) {
            alert('该 Topic 已存在');
            return;
        }

        TopicStore.add({ name, topicId, region, pinned: false });
        form.querySelector('.cls-form-name').value = '';
        form.querySelector('.cls-form-topic-id').value = '';
        toggleForm(false);
        renderTopicList();
    }

    function createUI() {
        if (document.querySelector('.cls-wrap')) return;

        TopicStore.load();
        UIState.load();

        const style = document.createElement('style');
        style.textContent = STYLE;
        document.head.appendChild(style);

        const wrap = document.createElement('div');
        wrap.className = 'cls-wrap';

        const tab = document.createElement('div');
        tab.className = 'cls-tab';
        tab.title = '点击恢复 Topic 切换';
        tab.onclick = (e) => { e.stopPropagation(); restoreFromCollapsed(); };

        const panel = document.createElement('div');
        panel.className = 'cls-panel';

        const toolbar = document.createElement('div');
        toolbar.className = 'cls-toolbar';

        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'cls-drag-handle';
        handle.title = '拖动';
        handle.innerHTML = ICON_GRIP;

        const hideBtn = document.createElement('button');
        hideBtn.type = 'button';
        hideBtn.className = 'cls-hide-btn';
        hideBtn.title = '隐藏';
        hideBtn.innerHTML = ICON_CLOSE;
        hideBtn.onclick = (e) => {
            e.stopPropagation();
            closeMenu();
            collapseToEdge(UIState.nearestEdge(UIState.x, UIState.y));
        };

        handle.onclick = (e) => e.stopPropagation();

        toolbar.appendChild(handle);
        toolbar.appendChild(hideBtn);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cls-btn';
        btn.title = 'CLS Topic 切换';
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="white"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8 13h8v2H8v-2zm0 4h5v2H8v-2z"/></svg>';

        const menu = document.createElement('div');
        menu.className = 'cls-menu';

        const listEl = document.createElement('div');
        listEl.className = 'cls-menu-list';

        const footer = document.createElement('div');
        footer.className = 'cls-menu-footer';

        const favBtn = document.createElement('button');
        favBtn.className = 'cls-footer-btn';
        favBtn.textContent = '⭐ 收藏当前';
        favBtn.onclick = (e) => { e.stopPropagation(); bookmarkCurrent(); };

        const addBtn = document.createElement('button');
        addBtn.className = 'cls-footer-btn';
        addBtn.textContent = '＋ 添加';
        addBtn.onclick = (e) => { e.stopPropagation(); toggleForm(true); };

        footer.appendChild(favBtn);
        footer.appendChild(addBtn);

        const form = document.createElement('div');
        form.className = 'cls-form';
        form.style.display = 'none';
        form.innerHTML = `
            <label>名称</label>
            <input class="cls-form-name" type="text" placeholder="Topic 名称">
            <label>Topic ID</label>
            <input class="cls-form-topic-id" type="text" placeholder="bf887d9e-...">
            <label>地域 region</label>
            <select class="cls-form-region"></select>
            <input class="cls-form-region-custom" type="text" placeholder="ap-xxx" style="display:none">
            <div class="cls-form-actions">
                <button class="cls-form-save" type="button">保存</button>
                <button class="cls-form-cancel" type="button">取消</button>
            </div>`;
        form.querySelector('.cls-form-save').onclick = (e) => { e.stopPropagation(); saveForm(); };
        form.querySelector('.cls-form-cancel').onclick = (e) => { e.stopPropagation(); toggleForm(false); };

        menu.appendChild(listEl);
        menu.appendChild(footer);
        menu.appendChild(form);

        panel.appendChild(toolbar);
        panel.appendChild(btn);

        wrap.appendChild(tab);
        wrap.appendChild(panel);
        document.body.appendChild(wrap);
        document.body.appendChild(menu);

        uiRefs = { wrap, tab, panel, toolbar, handle, btn, hideBtn, menu, listEl, footer, favBtn, addBtn, form };

        btn.onclick = (e) => {
            e.stopPropagation();
            if (menu.classList.contains('show')) {
                closeMenu();
            } else {
                openMenu();
            }
        };

        document.addEventListener('click', () => closeMenu());
        menu.onclick = (e) => e.stopPropagation();

        applyPosition();
        setupToolbarHover();
        setupDrag();
        renderTopicList();
        updateFooterButtons();

        window.addEventListener('resize', () => {
            UIState.clamp();
            applyPosition();
            if (menu.classList.contains('show')) positionMenu();
        });

        setInterval(updateFooterButtons, 2000);

        console.log('[CLS] UI ready v1.0.1');
    }

    function init() {
        console.log('[CLS] v1.0.1 - Topic 快速切换');

        const tryInit = () => {
            if (document.body) {
                createUI();
            } else {
                setTimeout(tryInit, 100);
            }
        };
        tryInit();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
