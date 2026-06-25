// ==UserScript==
// @name Rancher 快速导航
// @namespace http://tampermonkey.net/
// @version 3.3.0
// @description Rancher 快速切换集群和命名空间（无刷新、可拖动隐藏、环境可管理）
// @match https://rancher.heyteago.com/*
// @match https://rancher.lan.heytea.com/*
// @match https://rancher.lan.heytea-co.com/*
// @grant none
// @run-at document-end
// ==/UserScript==

(function () {
    'use strict';

    const UI_STATE_KEY = 'qn-ui-state';
    const ENVS_KEY = 'qn-envs';
    const SITE_KEY = location.hostname;

    function storageKey(base) {
        return `${base}:${SITE_KEY}`;
    }

    function migrateLegacyStorage() {
        const envScoped = storageKey(ENVS_KEY);
        const uiScoped = storageKey(UI_STATE_KEY);
        try {
            const legacyEnvs = localStorage.getItem(ENVS_KEY);
            if (legacyEnvs !== null && localStorage.getItem(envScoped) === null) {
                localStorage.setItem(envScoped, legacyEnvs);
                localStorage.removeItem(ENVS_KEY);
            }
        } catch (e) {
            console.warn('[QN] envs 迁移失败', e);
        }
        try {
            const legacyUi = localStorage.getItem(UI_STATE_KEY);
            if (legacyUi !== null && localStorage.getItem(uiScoped) === null) {
                localStorage.setItem(uiScoped, legacyUi);
                localStorage.removeItem(UI_STATE_KEY);
            }
        } catch (e) {
            console.warn('[QN] ui-state 迁移失败', e);
        }
    }

    const EDGE_THRESHOLD = 20;
    const BTN_SIZE = 48;
    const TOOLBAR_ZONE = 34;
    const TAB_HIT_W = 32;
    const TAB_HIT_H = 80;
    const TAB_VIS_W = 16;
    const TAB_VIS_H = 64;

    // ========== 样式 ==========
    const STYLE = `
.qn-wrap {
    position: fixed;
    z-index: 99999;
    width: ${BTN_SIZE}px;
    height: ${BTN_SIZE}px;
    overflow: visible;
    pointer-events: none;
    box-sizing: border-box;
}
.qn-wrap:not(.collapsed) {
    padding-left: ${TOOLBAR_ZONE}px;
    margin-left: -${TOOLBAR_ZONE}px;
    width: calc(${BTN_SIZE}px + ${TOOLBAR_ZONE}px);
    pointer-events: auto;
}
.qn-wrap .qn-panel,
.qn-wrap .qn-tab {
    pointer-events: auto;
}
.qn-wrap.collapsed {
    padding-left: 0 !important;
    margin-left: 0 !important;
    width: ${TAB_HIT_W}px !important;
    height: ${TAB_HIT_H}px !important;
    display: flex;
    align-items: center;
    justify-content: center;
}
.qn-wrap.collapsed .qn-panel { display: none; }
.qn-wrap.collapsed .qn-tab { display: flex; }

.qn-tab {
    display: none;
    align-items: center;
    justify-content: center;
    width: ${TAB_VIS_W}px;
    height: ${TAB_VIS_H}px;
    background: #007AFF;
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
.qn-tab:hover {
    filter: brightness(1.12);
    box-shadow: 0 2px 16px rgba(0,122,255,0.55);
}
.qn-wrap.collapsed.edge-right .qn-tab {
    border-radius: 10px 0 0 10px;
    margin-left: auto;
}
.qn-wrap.collapsed.edge-right .qn-tab:hover { width: ${TAB_VIS_W + 4}px; }
.qn-wrap.collapsed.edge-left .qn-tab {
    border-radius: 0 10px 10px 0;
    margin-right: auto;
}
.qn-wrap.collapsed.edge-left .qn-tab:hover { width: ${TAB_VIS_W + 4}px; }
.qn-wrap.collapsed.edge-top .qn-tab {
    border-radius: 0 0 10px 10px;
    width: ${TAB_VIS_H}px;
    height: ${TAB_VIS_W}px;
    margin-bottom: auto;
}
.qn-wrap.collapsed.edge-top .qn-tab:hover { height: ${TAB_VIS_W + 4}px; }
.qn-wrap.collapsed.edge-bottom .qn-tab {
    border-radius: 10px 10px 0 0;
    width: ${TAB_VIS_H}px;
    height: ${TAB_VIS_W}px;
    margin-top: auto;
}
.qn-wrap.collapsed.edge-bottom .qn-tab:hover { height: ${TAB_VIS_W + 4}px; }

.qn-panel {
    position: relative;
    width: ${BTN_SIZE}px;
    height: ${BTN_SIZE}px;
    overflow: visible;
}

/* 隔离 Rancher 对悬浮按钮的全局样式 */
.qn-wrap button,
.qn-panel button {
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

.qn-toolbar {
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
.qn-wrap.toolbar-show .qn-toolbar {
    opacity: 1;
    pointer-events: auto;
}
.qn-wrap.menu-open .qn-toolbar { opacity: 0 !important; pointer-events: none !important; }

.qn-drag-handle,
.qn-hide-btn {
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
.qn-drag-handle { cursor: grab; }
.qn-drag-handle:active { cursor: grabbing; }
.qn-drag-handle svg,
.qn-hide-btn svg { display: block; pointer-events: none; }
.qn-hide-btn:hover { background: rgba(255,59,48,0.9) !important; }
.qn-drag-handle:hover { background: rgba(50,50,50,0.92) !important; }

.qn-btn {
    position: relative;
    width: ${BTN_SIZE}px;
    height: ${BTN_SIZE}px;
    border-radius: 24px;
    background: #007AFF !important;
    border: none;
    box-shadow: 0 4px 12px rgba(0,122,255,0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    z-index: 1;
}
.qn-btn:hover { filter: brightness(1.08); }
.qn-btn:active { filter: brightness(0.95); }
.qn-btn svg { width: 22px; height: 22px; fill: white; pointer-events: none; }

.qn-wrap.menu-open .qn-hide-btn { display: none !important; }

.qn-menu {
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
.qn-menu.show { display: flex; }

/* 隔离 Rancher 全局 button/input 样式 */
.qn-menu button {
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
.qn-menu button:focus { outline: none !important; }

.qn-menu-list {
    overflow-y: auto;
    flex: 1 1 auto;
    min-height: 0;
    overscroll-behavior: contain;
}

.qn-section-label {
    padding: 6px 12px 4px;
    font-size: 11px;
    color: #86868b;
    background: #fafafa;
    border-bottom: 1px solid #f0f0f0;
}

.qn-item {
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
.qn-item:last-child { border-bottom: none; }
.qn-item:hover { background: #f5f5f7; }
.qn-item.is-dragging { opacity: 0.4; }
.qn-item.is-drag-over { background: #e8f4ff; }

.qn-item-body { flex: 1; cursor: pointer; min-width: 0; padding: 4px 4px 4px 0; }
.qn-item-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qn-ns { font-size: 11px; color: #86868b; margin-top: 2px; font-weight: 400; }

.qn-item-drag {
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
.qn-item-drag:hover { color: #636366; background: #ebebef !important; }
.qn-item-drag:active { cursor: grabbing; }
.qn-item-drag svg { display: block; pointer-events: none; }

.qn-item-actions {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 2px;
}

.qn-item-pin, .qn-item-del {
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
.qn-item-pin svg, .qn-item-del svg { display: block; pointer-events: none; }
.qn-item-pin:hover { color: #007AFF !important; background: rgba(0,122,255,0.1) !important; }
.qn-item-pin.pinned { color: #007AFF !important; }
.qn-item-del:hover { color: #ff3b30 !important; background: rgba(255,59,48,0.1) !important; }

.qn-menu-footer {
    display: flex;
    border-top: 1px solid #f0f0f0;
    flex-shrink: 0;
    min-height: 42px;
    background: #fff;
    border-radius: 0 0 12px 12px;
}
.qn-footer-btn {
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
.qn-footer-btn:hover { background: #f0f0f0; }
.qn-footer-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.qn-footer-btn + .qn-footer-btn { border-left: 1px solid #f0f0f0; }

.qn-form {
    padding: 12px;
    border-top: 1px solid #f0f0f0;
    background: #fafafa;
    flex-shrink: 0;
}
.qn-form label {
    display: block;
    font-size: 11px;
    color: #86868b;
    margin-bottom: 4px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}
.qn-form input, .qn-form select {
    width: 100%;
    padding: 6px 8px;
    margin-bottom: 8px;
    border: 1px solid #d2d2d7;
    border-radius: 6px;
    font-size: 13px;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}
.qn-form-actions { display: flex; gap: 8px; }
.qn-form-actions button {
    flex: 1;
    padding: 8px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
}
.qn-form-save { background: #007AFF; color: #fff; }
.qn-form-cancel { background: #e5e5ea; color: #1d1d1f; }
`;

    // ========== Rancher Store 工具 ==========
    function rancherStore() {
        return window.$nuxt?.$store;
    }

    function isNuxtReady() {
        const store = rancherStore();
        return !!(store && store.getters?.['clusterId']);
    }

    function getCurrentNs(store) {
        const filters = store.state.namespaceFilters || [];
        const nsFilter = filters.find(f => typeof f === 'string' && f.startsWith('ns://'));
        if (nsFilter) return nsFilter.replace('ns://', '');
        const byCluster = store.state.prefs?.data?.['ns-by-cluster'];
        const clusterId = store.getters['clusterId'];
        if (byCluster && clusterId && byCluster[clusterId]?.[0]) {
            return byCluster[clusterId][0].replace('ns://', '');
        }
        return '';
    }

    function getClusterName(store, clusterId) {
        const cluster = store.state.cluster;
        if (cluster && (cluster.id === clusterId || cluster.metadata?.name === clusterId)) {
            return cluster.spec?.displayName || cluster.nameDisplay || clusterId;
        }
        const mgmt = store.state.management?.clusters;
        if (mgmt) {
            const c = mgmt[clusterId] || Object.values(mgmt).find(x => x.id === clusterId);
            if (c) return c.spec?.displayName || c.nameDisplay || clusterId;
        }
        return clusterId;
    }

    function getClusterList() {
        const store = rancherStore();
        if (!store) return [];
        const result = [];
        const mgmt = store.state.management?.clusters;
        if (mgmt && typeof mgmt === 'object') {
            Object.values(mgmt).forEach(c => {
                const id = c.id || c.metadata?.name;
                if (id) result.push({ id, name: c.spec?.displayName || c.nameDisplay || id });
            });
        }
        if (result.length === 0) {
            const id = store.getters['clusterId'];
            if (id) result.push({ id, name: getClusterName(store, id) });
        }
        return result.sort((a, b) => a.name.localeCompare(b.name));
    }

    function getNamespaceList(clusterId) {
        const store = rancherStore();
        if (!store) return [];
        const raw = store.state.namespaces || store.getters?.namespaces || [];
        const list = Array.isArray(raw) ? raw : Object.values(raw || {});
        return list
            .map(ns => {
                const name = ns.name || ns.metadata?.name || ns.id;
                const cid = ns.clusterId || ns.metadata?.labels?.['cluster.cattle.io/cluster-name'];
                return name ? { name, clusterId: cid } : null;
            })
            .filter(Boolean)
            .filter(ns => !clusterId || !ns.clusterId || ns.clusterId === clusterId)
            .map(ns => ns.name)
            .filter((v, i, a) => a.indexOf(v) === i)
            .sort();
    }

    function genId() {
        return crypto.randomUUID ? crypto.randomUUID() : `qn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    // ========== EnvStore ==========
    const EnvStore = {
        _envs: [],
        _storageOk: true,

        load() {
            try {
                const raw = localStorage.getItem(storageKey(ENVS_KEY));
                if (raw) {
                    const data = JSON.parse(raw);
                    if (Array.isArray(data.envs)) {
                        this._envs = data.envs;
                        return;
                    }
                }
            } catch (e) {
                console.warn('[QN] envs 解析失败，使用空列表', e);
            }
            this._envs = [];
        },

        save() {
            if (!this._storageOk) return;
            try {
                localStorage.setItem(storageKey(ENVS_KEY), JSON.stringify({ envs: this._envs }));
            } catch (e) {
                this._storageOk = false;
                console.warn('[QN] localStorage 不可用，环境配置无法持久化');
            }
        },

        getSorted() {
            return [...this._envs].sort((a, b) => {
                if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                return a.order - b.order;
            });
        },

        exists(clusterId, ns) {
            return this._envs.some(e => e.clusterId === clusterId && e.ns === ns);
        },

        add(env) {
            const maxOrder = this._envs.reduce((m, e) => Math.max(m, e.order), -1);
            this._envs.push({ ...env, id: genId(), order: maxOrder + 1 });
            this.save();
        },

        remove(id) {
            this._envs = this._envs.filter(e => e.id !== id);
            this.save();
        },

        togglePin(id) {
            const env = this._envs.find(e => e.id === id);
            if (!env) return;
            env.pinned = !env.pinned;
            const group = this._envs.filter(e => e.pinned === env.pinned);
            const maxOrder = group.reduce((m, e) => Math.max(m, e.order), -1);
            env.order = maxOrder + 1;
            this.save();
        },

        reorder(dragId, targetId) {
            const sorted = this.getSorted();
            const dragIdx = sorted.findIndex(e => e.id === dragId);
            const targetIdx = sorted.findIndex(e => e.id === targetId);
            if (dragIdx < 0 || targetIdx < 0 || dragIdx === targetIdx) return;

            const dragEnv = this._envs.find(e => e.id === dragId);
            const targetEnv = this._envs.find(e => e.id === targetId);
            if (!dragEnv || !targetEnv || dragEnv.pinned !== targetEnv.pinned) return;

            const [moved] = sorted.splice(dragIdx, 1);
            sorted.splice(targetIdx, 0, moved);
            sorted.forEach((e, i) => {
                const env = this._envs.find(x => x.id === e.id);
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
                const raw = localStorage.getItem(storageKey(UI_STATE_KEY));
                if (!raw) return;
                const data = JSON.parse(raw);
                if (typeof data.x === 'number') this.x = data.x;
                if (typeof data.y === 'number') this.y = data.y;
                if (typeof data.hidden === 'boolean') this.hidden = data.hidden;
                if (data.edge) this.edge = data.edge;
            } catch (e) {
                console.warn('[QN] ui-state 解析失败，使用默认位置');
            }
            this.clamp();
        },

        save() {
            if (!this._storageOk) return;
            try {
                localStorage.setItem(storageKey(UI_STATE_KEY), JSON.stringify({
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

    // ========== 核心：无刷新导航 ==========
    async function navigate(cluster, ns) {
        const nuxt = window.$nuxt;
        if (!nuxt || !nuxt.$router || !nuxt.$store) {
            console.warn('[QN] $nuxt 未就绪');
            return;
        }

        const store = nuxt.$store;
        const router = nuxt.$router;
        const currentCluster = store.getters['clusterId'];

        console.log(`[QN] 导航: ${cluster}/${ns}, 当前: ${currentCluster}`);

        if (currentCluster !== cluster) {
            try {
                await router.push(`/c/${cluster}/explorer`);
                await waitForCluster(cluster);
            } catch (e) {
                console.warn('[QN] Router push error:', e.message);
            }
        }

        const currentPath = router.currentRoute?.path || '';
        if (!currentPath.includes('apps.deployment')) {
            try {
                await router.push(`/c/${cluster}/explorer/apps.deployment`);
            } catch (e) { /* 忽略重复导航 */ }
        }

        setNamespace(ns, cluster);
    }

    function waitForCluster(cluster) {
        return new Promise((resolve) => {
            let attempts = 0;
            const check = () => {
                attempts++;
                const store = window.$nuxt?.$store;
                if (store?.getters['clusterId'] === cluster && store?.getters['clusterReady']) {
                    resolve();
                    return;
                }
                if (attempts < 100) setTimeout(check, 100);
                else {
                    console.warn('[QN] 集群加载超时');
                    resolve();
                }
            };
            check();
        });
    }

    function setNamespace(ns, cluster) {
        const store = window.$nuxt?.$store;
        if (!store) return;

        const filters = [`ns://${ns}`];
        store.state.namespaceFilters = filters;

        const nsByCluster = { ...(store.state.prefs?.data?.['ns-by-cluster'] || {}) };
        nsByCluster[cluster] = filters;
        store.dispatch('prefs/set', { key: 'ns-by-cluster', value: nsByCluster });

        console.log(`[QN] Namespace: ${ns}`);
    }

    // ========== 自动登录 ==========
    function autoLogin() {
        if (!location.pathname.includes('/auth/login')) return;

        setTimeout(() => {
            const hostname = window.location.hostname;
            console.log(`[QN] 尝试登录，当前主机: ${hostname}`);
            if (hostname === 'rancher.heyteago.com') {
                window.location.href = 'https://rancher.heyteago.com/ssoLogin';
            } else if (hostname === 'rancher.lan.heytea.com') {
                window.location.href = 'https://rancher.lan.heytea.com/ssoLogin';
            } else {
                console.warn('[QN] 未匹配到合适的登录地址');
            }
        }, 500);
    }

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

    function renderEnvList() {
        const { listEl } = uiRefs;
        if (!listEl) return;

        const sorted = EnvStore.getSorted();
        const pinned = sorted.filter(e => e.pinned);
        const normal = sorted.filter(e => !e.pinned);

        let html = '';
        if (pinned.length) {
            html += '<div class="qn-section-label">📌 置顶</div>';
            html += pinned.map(renderEnvItem).join('');
        }
        if (normal.length) {
            if (pinned.length) html += '<div class="qn-section-label">全部</div>';
            html += normal.map(renderEnvItem).join('');
        }
        if (!sorted.length) {
            html = '<div class="qn-section-label" style="text-align:center;padding:16px">暂无环境，请收藏或添加</div>';
        }
        listEl.innerHTML = html;
        bindEnvItemEvents();
        if (uiRefs.menu?.classList.contains('show')) requestAnimationFrame(() => positionMenu());
    }

    const ICON_GRIP = '<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="2" cy="2" r="1.4"/><circle cx="8" cy="2" r="1.4"/><circle cx="2" cy="7" r="1.4"/><circle cx="8" cy="7" r="1.4"/><circle cx="2" cy="12" r="1.4"/><circle cx="8" cy="12" r="1.4"/></svg>';
    const ICON_CLOSE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    const ICON_STAR = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
    const ICON_STAR_OUTLINE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
    const ICON_DEL = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';

    function renderEnvItem(e) {
        return `<div class="qn-item" data-id="${e.id}">
            <button type="button" class="qn-item-drag" draggable="true" title="拖动排序">${ICON_GRIP}</button>
            <div class="qn-item-body" data-cluster="${e.clusterId}" data-ns="${e.ns}">
                <div class="qn-item-name">${escapeHtml(e.name)}</div>
                <div class="qn-ns">${escapeHtml(e.ns)}</div>
            </div>
            <div class="qn-item-actions">
                <button type="button" class="qn-item-pin${e.pinned ? ' pinned' : ''}" title="${e.pinned ? '取消置顶' : '置顶'}">${e.pinned ? ICON_STAR : ICON_STAR_OUTLINE}</button>
                <button type="button" class="qn-item-del" title="删除">${ICON_DEL}</button>
            </div>
        </div>`;
    }

    function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function bindEnvItemEvents() {
        const { listEl } = uiRefs;
        if (!listEl) return;

        listEl.querySelectorAll('.qn-item-body').forEach(el => {
            el.onclick = () => {
                navigate(el.dataset.cluster, el.dataset.ns);
                closeMenu();
            };
        });

        listEl.querySelectorAll('.qn-item-pin').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = btn.closest('.qn-item')?.dataset.id;
                if (id) { EnvStore.togglePin(id); renderEnvList(); }
            };
        });

        listEl.querySelectorAll('.qn-item-del').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = btn.closest('.qn-item')?.dataset.id;
                if (id && confirm('确定删除该环境？')) {
                    EnvStore.remove(id);
                    renderEnvList();
                }
            };
        });

        setupEnvDragReorder();
    }

    function setupEnvDragReorder() {
        const { listEl } = uiRefs;
        let dragId = null;
        let dragEl = null;

        listEl.querySelectorAll('.qn-item-drag').forEach(handle => {
            handle.onmousedown = (e) => e.stopPropagation();
            handle.onclick = (e) => e.stopPropagation();
            handle.ondragstart = (e) => {
                dragEl = handle.closest('.qn-item');
                dragId = dragEl?.dataset.id;
                if (!dragId) return;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', dragId);
                requestAnimationFrame(() => dragEl?.classList.add('is-dragging'));
            };
            handle.ondragend = () => {
                dragEl?.classList.remove('is-dragging');
                listEl.querySelectorAll('.qn-item.is-drag-over').forEach(el => el.classList.remove('is-drag-over'));
                dragId = null;
                dragEl = null;
            };
        });

        listEl.querySelectorAll('.qn-item').forEach(item => {
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
                    EnvStore.reorder(dragId, targetId);
                    renderEnvList();
                }
            };
        });
    }

    function updateFooterButtons() {
        const ready = isNuxtReady();
        if (uiRefs.favBtn) {
            uiRefs.favBtn.disabled = !ready;
            uiRefs.favBtn.title = ready ? '' : '请等待页面加载';
        }
        if (uiRefs.addBtn) {
            uiRefs.addBtn.disabled = !ready;
            uiRefs.addBtn.title = ready ? '' : '请等待页面加载';
        }
    }

    function bookmarkCurrent() {
        const store = rancherStore();
        if (!store) return;

        const clusterId = store.getters['clusterId'];
        const ns = getCurrentNs(store);
        if (!clusterId || !ns) {
            alert('无法读取当前集群或命名空间，请先切换到目标环境');
            return;
        }
        if (EnvStore.exists(clusterId, ns)) {
            alert('该环境已存在');
            return;
        }

        const clusterName = getClusterName(store, clusterId);
        const defaultName = `${clusterName}/${ns}`;
        const name = prompt('环境名称', defaultName);
        if (!name) return;

        EnvStore.add({ name, clusterId, clusterName, ns, pinned: false });
        renderEnvList();
    }

    function toggleForm(show) {
        const { form, listEl, footer } = uiRefs;
        if (!form) return;
        form.style.display = show ? 'block' : 'none';
        if (listEl) listEl.style.display = show ? 'none' : '';
        if (footer) footer.style.display = show ? 'none' : 'flex';

        if (show) {
            const clusterSelect = form.querySelector('.qn-form-cluster');
            const nsSelect = form.querySelector('.qn-form-ns');
            const clusters = getClusterList();
            clusterSelect.innerHTML = clusters.map(c =>
                `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`
            ).join('');
            const updateNs = () => {
                const cid = clusterSelect.value;
                const nss = getNamespaceList(cid);
                nsSelect.innerHTML = nss.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
                if (!nss.length) nsSelect.innerHTML = '<option value="">（暂无数据，请手动输入）</option>';
            };
            clusterSelect.onchange = updateNs;
            updateNs();
        }
        if (uiRefs.menu?.classList.contains('show')) requestAnimationFrame(() => positionMenu());
    }

    function saveForm() {
        const { form } = uiRefs;
        if (!form) return;

        const name = form.querySelector('.qn-form-name').value.trim();
        const clusterId = form.querySelector('.qn-form-cluster').value;
        const ns = form.querySelector('.qn-form-ns').value;
        if (!name || !clusterId || !ns) {
            alert('请填写完整信息');
            return;
        }
        if (EnvStore.exists(clusterId, ns)) {
            alert('该环境已存在');
            return;
        }

        const store = rancherStore();
        const clusterName = store ? getClusterName(store, clusterId) : clusterId;
        EnvStore.add({ name, clusterId, clusterName, ns, pinned: false });
        form.querySelector('.qn-form-name').value = '';
        toggleForm(false);
        renderEnvList();
    }

    function createUI() {
        if (document.querySelector('.qn-wrap')) return;

        migrateLegacyStorage();
        EnvStore.load();
        UIState.load();

        const style = document.createElement('style');
        style.textContent = STYLE;
        document.head.appendChild(style);

        const wrap = document.createElement('div');
        wrap.className = 'qn-wrap';

        const tab = document.createElement('div');
        tab.className = 'qn-tab';
        tab.title = '点击恢复导航';
        tab.onclick = (e) => { e.stopPropagation(); restoreFromCollapsed(); };

        const panel = document.createElement('div');
        panel.className = 'qn-panel';

        const toolbar = document.createElement('div');
        toolbar.className = 'qn-toolbar';

        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'qn-drag-handle';
        handle.title = '拖动';
        handle.innerHTML = ICON_GRIP;

        const hideBtn = document.createElement('button');
        hideBtn.type = 'button';
        hideBtn.className = 'qn-hide-btn';
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
        btn.className = 'qn-btn';
        btn.title = '快速导航';
        btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>';

        const menu = document.createElement('div');
        menu.className = 'qn-menu';

        const listEl = document.createElement('div');
        listEl.className = 'qn-menu-list';

        const footer = document.createElement('div');
        footer.className = 'qn-menu-footer';

        const favBtn = document.createElement('button');
        favBtn.className = 'qn-footer-btn';
        favBtn.textContent = '⭐ 收藏当前';
        favBtn.onclick = (e) => { e.stopPropagation(); bookmarkCurrent(); };

        const addBtn = document.createElement('button');
        addBtn.className = 'qn-footer-btn';
        addBtn.textContent = '＋ 添加';
        addBtn.onclick = (e) => { e.stopPropagation(); toggleForm(true); };

        footer.appendChild(favBtn);
        footer.appendChild(addBtn);

        const form = document.createElement('div');
        form.className = 'qn-form';
        form.style.display = 'none';
        form.innerHTML = `
            <label>名称</label>
            <input class="qn-form-name" type="text" placeholder="环境名称">
            <label>集群</label>
            <select class="qn-form-cluster"></select>
            <label>命名空间</label>
            <select class="qn-form-ns"></select>
            <div class="qn-form-actions">
                <button class="qn-form-save" type="button">保存</button>
                <button class="qn-form-cancel" type="button">取消</button>
            </div>`;
        form.querySelector('.qn-form-save').onclick = (e) => { e.stopPropagation(); saveForm(); };
        form.querySelector('.qn-form-cancel').onclick = (e) => { e.stopPropagation(); toggleForm(false); };

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
        renderEnvList();
        updateFooterButtons();

        window.addEventListener('resize', () => {
            UIState.clamp();
            applyPosition();
            if (menu.classList.contains('show')) positionMenu();
        });

        setInterval(updateFooterButtons, 2000);

        console.log('[QN] UI ready v3.3.0');
    }

    function watchRoute() {
        setInterval(() => {
            if (location.pathname.includes('/auth/login')) autoLogin();
        }, 1000);
    }

    function init() {
        console.log('[QN] v3.3.0 - 无刷新导航 + 可拖动隐藏 + 环境管理');

        const tryInit = () => {
            if (document.body) {
                autoLogin();
                createUI();
                watchRoute();
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
