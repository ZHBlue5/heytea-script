// ==UserScript==
// @name         DevOps BK — 变更弹窗增强
// @namespace    http://tampermonkey.net/
// @version      1.0.4
// @description  变更弹窗：radio 默认选中 + 复制/新标签页打开 SCC 链接
// @match        https://devops-bk.heyteago.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const SCC_ANCHOR = 'SCC变更链接为：';
    const URL_RE = /SCC变更链接为：\s*(https?:\/\/\S+)/;

    /**
     * 从预览文本中提取 SCC URL。
     * @param {string} text
     * @returns {string|null}
     */
    function extractUrl(text) {
        if (!text || !text.includes(SCC_ANCHOR)) return null;
        const m = text.match(URL_RE);
        return m ? m[1] : null;
    }

    /**
     * 在弹窗 body 内查找含 SCC 预览文本的最近块级容器。
     * @param {Element} dialogBody
     * @returns {{ container: Element, url: string } | null}
     */
    function findPreviewContainer(dialogBody) {
        const walker = document.createTreeWalker(
            dialogBody,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode(node) {
                    const t = node.textContent || '';
                    return t.includes(SCC_ANCHOR)
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_SKIP;
                }
            }
        );
        let node = walker.nextNode();
        if (!node) return null;

        // 取最内层含锚点文本的元素，避免命中整个 dialogBody
        while (node) {
            const children = [...node.children].filter(c =>
                (c.textContent || '').includes(SCC_ANCHOR)
            );
            if (children.length === 0) break;
            node = children[0];
        }

        const url = extractUrl(node.textContent || '');
        return url ? { container: node, url } : null;
    }

    const COPY_LABEL = '复制 SCC 链接';
    const COPY_DONE = '已复制 ✓';
    const OPEN_LABEL = '打开 SCC 链接';
    const FEEDBACK_MS = 1500;

    const STYLE = `
.scc-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
}
.scc-copy-btn,
.scc-open-btn {
    display: inline-block;
    padding: 4px 12px;
    font-size: 12px;
    line-height: 20px;
    border-radius: 2px;
    cursor: pointer;
    user-select: none;
}
.scc-copy-btn {
    color: #fff;
    background: #3A84FF;
    border: none;
}
.scc-copy-btn:hover { background: #2c6dd4; }
.scc-copy-btn:active { background: #1e5bb8; }
.scc-open-btn {
    color: #3A84FF;
    background: #fff;
    border: 1px solid #3A84FF;
}
.scc-open-btn:hover { background: #ebf3ff; }
.scc-open-btn:active { background: #d8e8ff; }
`;

    function ensureStyle() {
        if (document.getElementById('scc-copy-style')) return;
        const el = document.createElement('style');
        el.id = 'scc-copy-style';
        el.textContent = STYLE;
        document.head.appendChild(el);
    }

    async function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!ok) throw new Error('copy failed');
    }

    function injectSccActions(container, url) {
        if (container.dataset.sccActionsInjected === '1') return;
        container.dataset.sccActionsInjected = '1';

        ensureStyle();

        const wrap = document.createElement('div');
        wrap.className = 'scc-actions';

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'scc-copy-btn';
        copyBtn.textContent = COPY_LABEL;
        copyBtn.addEventListener('click', async () => {
            try {
                await copyToClipboard(url);
                copyBtn.textContent = COPY_DONE;
                setTimeout(() => { copyBtn.textContent = COPY_LABEL; }, FEEDBACK_MS);
            } catch (e) {
                copyBtn.textContent = '复制失败';
                setTimeout(() => { copyBtn.textContent = COPY_LABEL; }, FEEDBACK_MS);
            }
        });

        const openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = 'scc-open-btn';
        openBtn.textContent = OPEN_LABEL;
        openBtn.addEventListener('click', () => {
            const win = window.open(url, '_blank', 'noopener,noreferrer');
            if (!win) {
                openBtn.textContent = '打开失败';
                setTimeout(() => { openBtn.textContent = OPEN_LABEL; }, FEEDBACK_MS);
            }
        });

        wrap.append(copyBtn, openBtn);
        container.appendChild(wrap);
    }

    /**
     * 第一个必填 radio 组无选中时，自动选中第一个 label。
     * @param {Element} dialogBody
     */
    function defaultFirstRadio(dialogBody) {
        const form = dialogBody.querySelector('form');
        if (!form) return;
        const item = form.querySelector('.bk-form-item.is-required');
        if (!item) return;
        const radios = item.querySelectorAll('input[type="radio"]');
        if (!radios.length || [...radios].some(r => r.checked)) return;
        const label = item.querySelector('label');
        if (!label) return;
        label.click();
        if (![...radios].some(r => r.checked)) {
            radios[0].checked = true;
            radios[0].dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function processDialog(dialogBody) {
        defaultFirstRadio(dialogBody);
        const found = findPreviewContainer(dialogBody);
        if (!found) return;
        injectSccActions(found.container, found.url);
    }

    function scanExistingDialogs() {
        document.querySelectorAll('.bk-dialog-body').forEach(processDialog);
    }

    function collectDialogBodies(node, into) {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches?.('.bk-dialog-body')) into.add(node);
        node.querySelectorAll?.('.bk-dialog-body').forEach(db => into.add(db));
        const parent = node.closest?.('.bk-dialog-body');
        if (parent) into.add(parent);
    }

    function startDialogWatcher() {
        function boot() {
            if (!document.body) return;
            scanExistingDialogs();

            const observer = new MutationObserver(mutations => {
                const dialogs = new Set();
                for (const m of mutations) {
                    if (m.type === 'characterData') {
                        const db = m.target.parentElement?.closest?.('.bk-dialog-body');
                        if (db) dialogs.add(db);
                        continue;
                    }
                    for (const node of m.addedNodes) {
                        collectDialogBodies(node, dialogs);
                    }
                }
                dialogs.forEach(processDialog);
            });

            // ponytail: subtree 捕获弹窗内异步填入的预览文本；characterData 捕获纯文本更新
            observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        }

        if (document.body) boot();
        else document.addEventListener('DOMContentLoaded', boot, { once: true });
    }

    if (typeof document !== 'undefined') {
        startDialogWatcher();
    }
})();
