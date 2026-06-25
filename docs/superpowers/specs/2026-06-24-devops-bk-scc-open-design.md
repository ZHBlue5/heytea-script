# DevOps BK — SCC 链接打开新标签页设计

**日期：** 2026-06-24  
**状态：** 已实现（v1.0.3）  
**文件：** `devops-bk.js`（Tampermonkey 油猴脚本 v1.0.3）  
**关联 spec：** [SCC 链接复制](./2026-06-24-devops-bk-scc-copy-design.md)

## 背景

`devops-bk.js`（v1.0.2）已在变更弹窗预览区提供「复制 SCC 链接」按钮。用户除复制外，还需频繁 **在新标签页直接打开** SCC 变更链接（`admin-scc.lan.heytea.com`），减少手动粘贴地址栏的步骤。

## 目标

在预览文本区域，与复制按钮并排新增 **「打开 SCC 链接」** 按钮，点击后于 **新标签页** 打开与复制按钮相同的 SCC URL。

## 约束

- 扩展 `devops-bk.js`，不新建脚本
- `@match` 仍为 `https://devops-bk.heyteago.com/*`
- `@grant none`（通过用户点击触发 `window.open`，无需 GM API）
- URL 来源与复制按钮相同：`SCC变更链接为：` 后正则提取
- 复用现有 `DialogWatcher` / `findPreviewContainer` 流程

## 方案选择

采用 **方案 A：重构为 `injectSccActions`**。

| 方案 | 描述 | 结论 |
|------|------|------|
| A（选用） | `injectCopyButton` 升级为 `injectSccActions`，一次注入复制 + 打开 | DRY，共用 URL 与去重 |
| B | 独立 `injectOpenButton` | 重复逻辑 |
| C | `<a target="_blank">` 替代按钮 | 语义好但 UI 与现有按钮风格不统一 |

## 架构

| 模块 | 变更 |
|------|------|
| `injectSccActions(container, url)` | 替代 `injectCopyButton`，注入按钮组 |
| `STYLE` | 新增 `.scc-actions` 容器、`.scc-open-btn` outline 样式 |
| `processDialog` | 调用 `injectSccActions`（名称替换，逻辑不变） |

### 数据流

```
findPreviewContainer → injectSccActions(container, url)
  ├── 复制按钮 → copyToClipboard(url)
  └── 打开按钮 → window.open(url, '_blank', 'noopener,noreferrer')
```

## UI 规格

| 项 | 值 |
|---|---|
| 容器 | `.scc-actions`（flex 行，`margin-top: 8px`，`gap: 8px`） |
| 复制按钮 | 「复制 SCC 链接」，实心蓝 `#3A84FF`（现有样式） |
| 打开按钮 | 「打开 SCC 链接」，白底蓝边 outline，hover 浅蓝底 |
| 去重标记 | `data-scc-actions-injected="1"`（替代 `data-scc-copy-injected`） |

## 打开逻辑

- 在用户 `click` 回调中调用 `window.open(url, '_blank', 'noopener,noreferrer')`
- 不使用当前窗口跳转
- 打开失败（被拦截）时按钮短暂显示「打开失败」，1.5s 后恢复

## 脚本元数据变更

| 字段 | 变更 |
|------|------|
| `@version` | `1.0.2` → `1.0.3` |
| `@description` | 补充「新标签页打开 SCC 链接」 |

## 错误处理

| 场景 | 处理 |
|------|------|
| URL 未提取到 | 不注入按钮组（现有逻辑） |
| `window.open` 返回 `null`（被拦截） | 按钮显示「打开失败」，1.5s 恢复 |
| 已注入 | `data-scc-actions-injected` 跳过 |

## 测试计划

1. 变更弹窗预览区出现两个并排按钮
2. 点击「打开 SCC 链接」→ 新标签页打开正确 SCC URL
3. 点击「复制 SCC 链接」→ 行为与 v1.0.2 一致
4. 关闭再打开弹窗 → 按钮仍正常出现
5. radio 默认选中功能不受影响

## 不在范围内

- 打开非 SCC 的 URL
- 当前窗口跳转
- 修改 `@grant`
- 第三个操作按钮
