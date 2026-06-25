# DevOps BK — SCC 链接复制 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `devops-bk.heyteago.com` 变更弹窗预览区注入「复制 SCC 链接」按钮，一键复制 SCC URL 到剪贴板。

**Architecture:** 单文件油猴脚本 `devops-bk.js`，`MutationObserver` 监听 `.bk-dialog-body` 插入，在弹窗 subtree 内搜索含 `SCC变更链接为：` 的文本并用正则提取 URL，注入 inline 复制按钮。`@grant none`，剪贴板 fallback 到 `execCommand`。

**Tech Stack:** Tampermonkey userscript、原生 DOM API、`navigator.clipboard`

**Spec:** [2026-06-24-devops-bk-scc-copy-design.md](../specs/2026-06-24-devops-bk-scc-copy-design.md)

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `devops-bk.js` | 新建 | 油猴脚本：URL 提取、复制按钮、弹窗监听 |
| `docs/superpowers/specs/2026-06-24-devops-bk-scc-copy-design.md` | 已有 | 设计 spec，实现完成后更新状态为「已实现」 |

---

### Task 1: URL 提取函数 + 自测

**Files:**
- Create: `devops-bk.js`

- [ ] **Step 1: 创建脚本骨架与 `extractUrl` 函数**

创建 `devops-bk.js`，包含 UserScript 元数据和纯函数 `extractUrl`：

```javascript
// ==UserScript==
// @name         DevOps BK — SCC 链接复制
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  变更弹窗预览区一键复制 SCC 变更链接
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

    // ponytail: Node 下可跑自测；浏览器里无 module.exports 则跳过
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { extractUrl };
    }
})();
```

- [ ] **Step 2: 运行自测验证 extractUrl**

Run:

```bash
node -e "
const { extractUrl } = require('./devops-bk.js');
const sample = \`变更环境为【PROD】
SCC变更链接为：
https://admin-scc.lan.heytea.com/application/pipeline?apolloType=apollo-go&envs=prd\`;
console.assert(extractUrl(sample) === 'https://admin-scc.lan.heytea.com/application/pipeline?apolloType=apollo-go&envs=prd', 'basic');
console.assert(extractUrl('no anchor') === null, 'no anchor');
console.assert(extractUrl('SCC变更链接为：\\nhttps://x.com/a b') === 'https://x.com/a', 'trim trailing');
console.log('extractUrl: all passed');
"
```

Expected: `extractUrl: all passed`

- [ ] **Step 3: 添加 `findPreviewContainer` 辅助函数**

在 `extractUrl` 下方追加：

```javascript
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
```

---

### Task 2: 剪贴板复制 + 按钮 UI

**Files:**
- Modify: `devops-bk.js`

- [ ] **Step 1: 添加样式常量与 `copyToClipboard`**

在 `findPreviewContainer` 下方追加：

```javascript
    const BTN_LABEL = '复制 SCC 链接';
    const BTN_DONE = '已复制 ✓';
    const FEEDBACK_MS = 1500;

    const STYLE = `
.scc-copy-btn {
    display: inline-block;
    margin-top: 8px;
    padding: 4px 12px;
    font-size: 12px;
    line-height: 20px;
    color: #fff;
    background: #3A84FF;
    border: none;
    border-radius: 2px;
    cursor: pointer;
    user-select: none;
}
.scc-copy-btn:hover { background: #2c6dd4; }
.scc-copy-btn:active { background: #1e5bb8; }
`;

    function ensureStyle() {
        if (document.getElementById('scc-copy-style')) return;
        const el = document.createElement('style');
        el.id = 'scc-copy-style';
        el.textContent = STYLE;
        document.head.appendChild(el);
    }

    /**
     * 写入剪贴板，clipboard API 不可用时 fallback。
     * @param {string} text
     * @returns {Promise<void>}
     */
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
```

- [ ] **Step 2: 添加 `injectCopyButton`**

```javascript
    /**
     * 在预览容器旁注入复制按钮（同一容器只注入一次）。
     * @param {Element} container
     * @param {string} url
     */
    function injectCopyButton(container, url) {
        if (container.dataset.sccCopyInjected === '1') return;
        container.dataset.sccCopyInjected = '1';

        ensureStyle();

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'scc-copy-btn';
        btn.textContent = BTN_LABEL;

        btn.addEventListener('click', async () => {
            try {
                await copyToClipboard(url);
                btn.textContent = BTN_DONE;
                setTimeout(() => { btn.textContent = BTN_LABEL; }, FEEDBACK_MS);
            } catch (e) {
                btn.textContent = '复制失败';
                setTimeout(() => { btn.textContent = BTN_LABEL; }, FEEDBACK_MS);
            }
        });

        container.appendChild(btn);
    }
```

---

### Task 3: DialogWatcher 启动

**Files:**
- Modify: `devops-bk.js`

- [ ] **Step 1: 添加 `processDialog` 与 `DialogWatcher`**

在 `injectCopyButton` 下方追加：

```javascript
    function processDialog(dialogBody) {
        const found = findPreviewContainer(dialogBody);
        if (!found) return;
        injectCopyButton(found.container, found.url);
    }

    function scanExistingDialogs() {
        document.querySelectorAll('.bk-dialog-body').forEach(processDialog);
    }

    function startDialogWatcher() {
        scanExistingDialogs();

        const observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    if (node.matches?.('.bk-dialog-body')) {
                        processDialog(node);
                    }
                    node.querySelectorAll?.('.bk-dialog-body').forEach(processDialog);
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    startDialogWatcher();
})();
```

- [ ] **Step 2: 确认文件完整性**

Run:

```bash
node -e "
const { extractUrl } = require('./devops-bk.js');
console.assert(extractUrl('SCC变更链接为： https://a.com/x') === 'https://a.com/x');
console.log('final self-check ok');
"
head -12 devops-bk.js
tail -5 devops-bk.js
```

Expected: `final self-check ok`，头部含 `@match`，尾部含 `startDialogWatcher();` 和 `})();`

---

### Task 4: 更新 spec 状态 + 手动验证

**Files:**
- Modify: `docs/superpowers/specs/2026-06-24-devops-bk-scc-copy-design.md`

- [ ] **Step 1: 更新 spec 状态**

将 spec 第 4 行 `**状态：** 待实现` 改为 `**状态：** 已实现（v1.0.0）`

- [ ] **Step 2: Tampermonkey 安装**

1. 打开 Tampermonkey → 添加新脚本
2. 粘贴 `devops-bk.js` 全文，保存
3. 确认 `@match` 为 `https://devops-bk.heyteago.com/*`

- [ ] **Step 3: 手动测试清单**

在 `https://devops-bk.heyteago.com/` 执行 spec 测试计划：

1. 触发变更弹窗 → 预览区下方出现蓝色「复制 SCC 链接」按钮
2. 点击按钮 → 按钮短暂显示「已复制 ✓」
3. 粘贴到记事本 → URL 与预览文本中 `SCC变更链接为：` 后的链接一致
4. 关闭弹窗再打开 → 按钮仍出现
5. 打开不含 SCC 文本的其他弹窗 → 不出现按钮

---

## Spec Coverage Checklist

| Spec 要求 | 对应 Task |
|-----------|-----------|
| `@match devops-bk.heyteago.com` | Task 1 元数据 |
| `@grant none` | Task 1 元数据 |
| MutationObserver 监听弹窗 | Task 3 |
| 语义文本 `SCC变更链接为：` 提取 URL | Task 1 `extractUrl` + `findPreviewContainer` |
| 单按钮复制 URL | Task 2 `injectCopyButton` |
| 已复制反馈 1.5s | Task 2 `FEEDBACK_MS` |
| BK 蓝 `#3A84FF` | Task 2 STYLE |
| `data-scc-copy-injected` 去重 | Task 2 `injectCopyButton` |
| clipboard fallback | Task 2 `copyToClipboard` |
| 不复制整段文本 | Task 2 仅 `copyToClipboard(url)` |

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-24-devops-bk-scc-copy.md`.
