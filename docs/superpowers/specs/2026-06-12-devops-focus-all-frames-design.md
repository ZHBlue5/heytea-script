# DevOps Focus — iframe 内 DOM 扫描修复

**日期：** 2026-06-12  
**状态：** 已实现  
**文件：** `devops-focus.js`  
**关联：** [Ctool 平台能力边界](../../../../school/Ctool/docs/superpowers/specs/2026-06-27-userscript-platform-capabilities-design.md)

## 背景

Ctool 注入修复后 `devops-focus.js` 可加载，但 `handleButtons()` 中各类节点计数均为 0。DevTools 确认流水线 UI 位于 **iframe 子框架**，非主文档。

## 根因

- Ctool 默认 `@inject-into page`，仅在主框架（`frameId 0`）执行
- 脚本使用 `document.querySelectorAll`，只能扫描当前 frame 的 document
- Tampermonkey 常默认注入 all-frames，故 TM 正常、Ctool 计数为 0

## 方案

在元数据增加：

```javascript
// @inject-into all-frames
```

依赖 Ctool v2 已有 `userscriptInjectionTarget()` → `{ allFrames: true }`。

## 实现

- `devops-focus.js` v0.9：`@inject-into all-frames`
- 节点统计 log 仅在 `allButtons.length > 0` 时输出，减少空 iframe 噪音
- `index.json` 版本 `0.9.0`

## 非目标

- 不改 Ctool 平台
- 不实现主框架遍历 iframe 的 fallback

## 验证

- [ ] Ctool：流水线 iframe 内节点计数 > 0
- [ ] Ctool：审核按钮 auto-click、悬停滚动正常
- [ ] Tampermonkey 回归
