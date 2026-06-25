# DevOps BK — Ctool 注入不生效修复设计

**日期：** 2026-06-27  
**状态：** 待实现  
**关联脚本：** `devops-bk.js`（heytea-script catalog）  
**关联平台：** Ctool Chrome 扩展 `userscript-background.js`  
**关联 spec：** [SCC 链接复制](./2026-06-24-devops-bk-scc-copy-design.md)、[radio 默认选中](./2026-06-24-devops-bk-radio-default-design.md)

## 背景

`devops-bk.js` 在 Tampermonkey 下正常（变更弹窗 radio 默认选中 + SCC 复制/打开按钮）。同一页面、同一浏览器，Ctool Userscript 启用并硬刷新后**两项功能均不生效**。Ctool 其他脚本（rancher、cls）正常。

## 目标

- Ctool 扩展在 `devops-bk.heyteago.com` 上可靠注入并运行 `devops-bk.js`
- 行为与 Tampermonkey 一致：弹窗内 radio 默认选中 + SCC 操作按钮
- 平台级修复不破坏其他站点 userscript 注入

## 非目标

- 不改 `@match` / `@grant none`
- v1 不做 all-frames 注入
- 不改 SCC 提取 / UI 业务逻辑
- 不改为 GM 存储

## 已确认现象（用户）

| 项 | 结论 |
|----|------|
| 失效范围 | radio + SCC 按钮均无（C） |
| Tampermonkey | 正常（A） |
| 其他 Ctool 脚本 | 正常（A） |
| 启用后硬刷新 | 已刷新仍无效（A） |

## 根因假设（按优先级）

### H1：iframe `complete` 风暴（主因，平台）

`userscriptHandleTabUpdated` **未过滤 `info.frameId`**。蓝鲸 DevOps 页含多个 iframe，子帧 `status === 'complete'` 时同样触发：

1. `userscriptClearTabSessions(tabId)` — 清空该 tab 全部注入标记  
2. 重新 `userscriptInjectMatching`

频繁清标记 + 异步重注入导致竞态或注入失败，脚本未稳定驻留。rancher 等页面 iframe 较少，故未暴露。

### H2：MAIN world 下 `module.exports` 块（脚本卫生）

Ctool 在 `world: 'MAIN'` 执行 userscript；蓝鲸页 webpack 常暴露全局 `module`。脚本末尾：

```javascript
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { extractUrl };  // extractUrl 在 IIFE 内，ReferenceError
}
```

Tampermonkey 隔离 world 无 `module`，跳过该块。应删除（仅 Node 单测用）。

### H3：弹窗在 iframe 内

证据不足（TM 默认也仅顶层 frame），v1 不处理。

---

## 方案选择

采用 **方案 A**：平台 `frameId === 0` 过滤 + 脚本清理。

---

## 设计

### 1. Ctool 平台修复

**文件：** `packages/ctool-adapter/chrome/resources/userscript-background.js`

```javascript
async function userscriptHandleTabUpdated(tabId, info, tab) {
    if (info.frameId !== 0) return
    if (!tab?.url?.startsWith('http')) return
    // ... 现有 loading / complete 逻辑不变
}
```

**说明：**

- 仅主框架 navigation / complete 触发 userscript 生命周期
- 子 iframe 加载不再清空注入状态、不再重注入

**可选（推荐）：** `userscriptInject` 外层 try/catch，失败时 `console.error('[userscript] inject failed', tabId, record.id, err)`，便于后续排查。

### 2. devops-bk 脚本修复

**文件：** `devops-bk.js`

| 改动 | 说明 |
|------|------|
| 删除 `module.exports` 块 | 移除 Node 自测导出，避免 MAIN world 冲突 |
| `startDialogWatcher` 守卫 | 无 `document.body` 时 `DOMContentLoaded` 后再挂载 observer |
| 版本 | `@version` `1.0.3` → **`1.0.4`** |

```javascript
function startDialogWatcher() {
    function boot() {
        if (!document.body) return
        scanExistingDialogs()
        // ... observer 逻辑不变
    }
    if (document.body) boot()
    else document.addEventListener('DOMContentLoaded', boot, { once: true })
}
```

业务逻辑（`processDialog`、`MutationObserver` 选项、SCC 按钮）**不变**。

### 3. 发布

- heytea-script：`npm run generate-index`，更新 catalog
- Ctool：重新构建并加载扩展

---

## 验证清单

### devops-bk 功能

- [ ] Ctool 启用 devops-bk，打开 `https://devops-bk.heyteago.com/*`，硬刷新
- [ ] 发起变更 → 弹窗内第一个必填 radio 自动选中
- [ ] 预览含 `SCC变更链接为：` 时出现「复制 / 打开」按钮且可用
- [ ] 多次开闭弹窗行为稳定

### 回归

- [ ] rancher / cls 在 Ctool 下仍正常注入
- [ ] Tampermonkey 装 devops-bk 仍正常（脚本改动无功能回归）

### 平台

- [ ] devops-bk 页 iframe 加载时 background 不再频繁 clear/inject（可观察扩展 service worker 日志）

---

## 文件改动清单

| 仓库 | 文件 |
|------|------|
| Ctool | `packages/ctool-adapter/chrome/resources/userscript-background.js` |
| heytea-script | `devops-bk.js`、`index.json` |

---

## 后续（v2，不在范围）

- `@inject-into all-frames` 元数据 + Ctool 多 frame 注入
- 注入健康检查（页面 marker 探测 + 自动重试）
- devops-bk 单测迁出 `module.exports` 到独立 test 文件
