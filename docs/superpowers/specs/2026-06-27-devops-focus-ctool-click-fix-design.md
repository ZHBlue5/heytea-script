# DevOps Focus — Ctool 自动 click 修复设计

**日期：** 2026-06-27  
**状态：** 待实现  
**文件：** `devops-focus.js`  
**关联：** [Ctool 平台能力边界](../../../../school/Ctool/docs/superpowers/specs/2026-06-27-userscript-platform-capabilities-design.md)

## 背景

`devops-focus.js` 在 Tampermonkey 下审核按钮可自动 `click()`；Ctool 下有日志和滚动，但无 auto-click。平台分析结论：注入与 DOM 权限正常，问题在脚本逻辑。

## 根因

1. **仅 `index === 0` 且为审核按钮才 auto-click** — 合并数组中 FAILED/RUNNING 等常排第一，导致滚动但无 click
2. **晚出现的审核按钮** 已 `handlerAttached`，不再调度 click
3. **`mouseenter` 使用 `e.target`** — 子节点无 `atom-reviewing-tips`，悬停不 click

## 目标

- 每个**首次绑定**的 `.atom-reviewing-tips` 节点在短延迟后 auto-click（未 disabled）
- 悬停 click 使用闭包 `button` 引用
- `@run-at document-idle` 对齐流水线 DOM 就绪
- v0.8

## 非目标

- 不改 Ctool 平台
- 不加 `@config`
- 不改为 all-frames

## 实现要点

### `scheduleReviewClick(button)`

- 仅 `button.classList.contains('atom-reviewing-tips')`
- `setTimeout` 300ms 后检查 `isConnected`、非 `disabled` → `click()`
- 每个按钮 `dataset.reviewClickScheduled = '1'` 防重复

### `handleButtons`

- 去掉 `index === 0` 的 click 逻辑
- 第一个节点仍可做首次滚动（优先第一个审核按钮，否则 index 0）
- 新绑定审核按钮 → `scheduleReviewClick(button)`
- `mouseenter`：`scrollToButton(button)`；审核且非 disabled → `click()`

### 启动

- `@run-at document-idle`
- 保留 `MutationObserver` + `document.body` 守卫

## 验证

- [ ] Ctool：流水线页审核按钮自动 click
- [ ] Ctool：FAILED 先出现时，审核按钮出现后仍 auto-click
- [ ] 悬停审核按钮可 click
- [ ] Tampermonkey 回归
