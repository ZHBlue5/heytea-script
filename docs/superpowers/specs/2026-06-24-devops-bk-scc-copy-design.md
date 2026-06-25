# DevOps BK — SCC 链接复制设计

**日期：** 2026-06-24  
**状态：** 已实现（v1.0.0）  
**文件：** `devops-bk.js`（Tampermonkey 油猴脚本 v1.0.0）

## 背景

在 `https://devops-bk.heyteago.com/` 发起变更时，弹窗表单内会展示一段预览文本，包含变更环境、标题、原因、领域、应用及 SCC 变更链接。日常操作中需要频繁将 **SCC 变更链接 URL** 复制到其他渠道（如 IM、工单），手动选中长 URL 效率低且易出错。

## 目标

在变更弹窗的预览文本区域旁注入 **一个复制按钮**，点击后将 SCC URL 写入剪贴板。

复制内容示例（仅供理解页面上下文，按钮**不复制**整段文本）：

```
变更环境为【PROD】
当前变更标题为【请填写变更标题】
当前变更原因为【请填写变更原因】
当前变更领域为【heyteago】
当前变更应用为【center-wechat-platform】
SCC变更链接为：
https://admin-scc.lan.heytea.com/application/pipeline?apolloType=...
```

按钮仅复制 `https://admin-scc.lan.heytea.com/...` 部分。

## 约束

- `@match` 限定 `https://devops-bk.heyteago.com/*`
- `@grant none`，不使用 `GM_*` API
- `@run-at document-end`
- 单文件实现，与现有 `rancher.js` / `cls.js` 风格一致
- 不使用用户提供的 `body > div:nth-child(13) > ...`  brittle 选择器，改用语义定位

## 方案选择

采用 **方案 A：MutationObserver + 语义文本定位**。

| 方案 | 描述 | 结论 |
|------|------|------|
| A（选用） | 监听 `.bk-dialog-body` 出现，搜索含 `SCC变更链接为：` 的节点并提取 URL | 弹窗动态加载可靠，不依赖 DOM 层级序号 |
| B | 固定 `nth-child` 选择器 | 页面结构变动即失效 |
| C | 定时轮询扫描 | 浪费资源，弹窗关闭后可能误触 |

## 架构

在 `devops-bk.js` 内三个逻辑块（仍单文件）：

| 模块 | 职责 |
|------|------|
| `DialogWatcher` | `MutationObserver` 监听 `document.body`，检测 `.bk-dialog-body` 插入 |
| `UrlExtractor` | 在弹窗内查找含 `SCC变更链接为：` 的文本，正则提取 URL |
| `CopyButton` | 注入按钮、处理点击、剪贴板写入、已复制反馈 |

### 数据流

```
页面加载
  → DialogWatcher 启动 Observer
  → 检测到 .bk-dialog-body
  → UrlExtractor 在弹窗 subtree 内搜索文本
  → 正则提取 URL
  → CopyButton 注入（同一弹窗仅一次）
  → 用户点击 → navigator.clipboard.writeText(url)
  → 按钮文案变为「已复制 ✓」，1.5s 后恢复
```

## URL 提取规则

- **搜索范围：** 当前 `.bk-dialog-body` 内的所有文本节点/元素
- **匹配锚点：** 文本包含 `SCC变更链接为：`
- **正则：** `/SCC变更链接为：\s*(https?:\/\/\S+)/`
- **失败处理：** 未匹配到 URL 时不注入按钮

## UI 规格

| 项 | 值 |
|---|---|
| 按钮文案 | `复制 SCC 链接` |
| 成功反馈 | `已复制 ✓`（1.5s 后恢复） |
| 位置 | 预览文本容器内，文本下方 inline 排列 |
| 主色 | `#3A84FF`（BK 蓝） |
| 防重复 | 容器标记 `data-scc-copy-injected="1"` |

按钮样式为小型 inline 按钮，不遮挡表单其他控件。

## 错误处理

| 场景 | 处理 |
|---|---|
| 弹窗未出现 / 无 SCC 文本 | 不注入按钮，Observer 继续监听 |
| URL 提取失败 | 不注入按钮 |
| `navigator.clipboard` 不可用 | fallback：`textarea` + `document.execCommand('copy')` |
| 弹窗关闭后再打开 | 新弹窗无 `data-scc-copy-injected` 标记，重新注入 |
| 同一弹窗多次 Observer 触发 | `data-scc-copy-injected` 去重，跳过 |

## 测试计划

1. 打开 `https://devops-bk.heyteago.com/`，触发变更弹窗
2. 确认预览区出现「复制 SCC 链接」按钮
3. 点击按钮，粘贴验证 URL 与预览文本中一致
4. 关闭弹窗再打开，按钮仍正常出现
5. 无 SCC 文本的弹窗不出现按钮

## 不在范围内

- 复制整段变更预览文本（用户明确只需 URL）
- 多按钮（整段 + 链接分开复制）
- 跨域页面（SCC 平台本身）的适配
- 远程配置或 localStorage 持久化
