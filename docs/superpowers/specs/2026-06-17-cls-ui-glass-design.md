# CLS Topic 切换 — 玻璃拟态 UI 设计

**日期：** 2026-06-17  
**状态：** 已实现（v1.1.0）  
**文件：** `cls.js`  
**关联 spec：** [CLS Topic 切换](./2026-06-17-cls-topic-switch-design.md)

## 背景

`cls.js` UI 从 `rancher.js` 复制，白底实心菜单与 CLS 控制台场景不协调，且与 rancher 难以区分。

## 目标

1. **玻璃拟态轻悬浮** — 半透明毛玻璃 + 柔和阴影
2. **固定浅色玻璃** — 不随 CLS 页面明暗切换
3. **当前 Topic 高亮** — URL 中 `topic_id` + `region` 匹配项左侧蓝条 + 浅蓝底
4. **与 rancher 区分** — 主按钮白玻璃 + 蓝边，非实心蓝球

## 设计令牌

```css
--cls-glass-bg: rgba(255, 255, 255, 0.72);
--cls-glass-bg-solid: rgba(255, 255, 255, 0.92);
--cls-glass-border: rgba(255, 255, 255, 0.55);
--cls-glass-shadow: 0 8px 32px rgba(0, 40, 120, 0.12);
--cls-blur: blur(16px);
--cls-accent: #006EFF;
--cls-accent-soft: rgba(0, 110, 255, 0.10);
--cls-text: #1a1a2e;
--cls-text-muted: #6b7280;
--cls-radius: 14px;
```

`backdrop-filter` 不可用时降级 `--cls-glass-bg-solid`。

## 组件

| 组件 | 样式 |
|------|------|
| 主按钮 | 白玻璃圆 + 蓝色描边 + 蓝色图标 |
| 工具条 | 半透明毛玻璃小圆钮 |
| 菜单 | backdrop-filter + 半透明白底 |
| 列表项 active | 左 3px 蓝条 + accent-soft 背景 |
| region 副标题 | ui-monospace 11px |
| 贴边标签 | 浅色玻璃 + 蓝色强调 |
| 表单 | 半透明白输入框，保存按钮实心蓝 |

## JS 变更

`renderTopicItem()` 对比 `getCurrentTopicFromUrl()`，匹配时添加 `cls-item active`。

## 不在范围内

- 不改 rancher.js
- 不改交互逻辑（拖动/隐藏/切换）
- 不做明暗主题自动检测

## 版本

`1.0.1` → `1.1.0`
