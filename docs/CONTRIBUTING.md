# 贡献指南

欢迎向 [ZHBlue5/heytea-script](https://github.com/ZHBlue5/heytea-script) 提交官方 Userscript。本文说明仓库约定、发布流程与 **Ctool 本地验证**。

**配置项声明：** 见 [@config 规范](./config.md)。

---

## 仓库角色

| 项 | 说明 |
|----|------|
| 用途 | Heytea 官方 Userscript **catalog**，供 Ctool 内置源同步 |
| 发布物 | 仓库**根目录** `*.js` + 自动生成的 `index.json` |
| 不进 catalog | `docs/`、`scripts/`、`.github/` 等 |

Ctool 内置源：`ZHBlue5/heytea-script`（分支 `main`）。打开 Userscript 工具或扩展后台会**自动同步**；新脚本默认**停用**，需手动启用。

---

## 新增或修改脚本

1. 在根目录新增或编辑 `your-script.js`  
2. 递增元数据中的 **`@version`**（semver）  
3. 运行 `npm run generate-index` 更新 `index.json`  
4. 运行 `npm run check-index` 确认 CI 可通过  
5. `git commit` 并 `push origin main`

**不要手改 `index.json`**，由 [`scripts/generate-index.mjs`](../scripts/generate-index.mjs) 从 `==UserScript==` 块生成。

---

## 元数据规范

每个脚本必须包含完整的 `==UserScript==` … `==/UserScript==` 块。

| 字段 | 要求 | 本仓惯例 |
|------|------|----------|
| `@name` | **必填** | 中文功能名 |
| `@version` | **必填**，semver | 每次发布递增；写入 `index.json` |
| `@description` | 推荐 | 一句话说明场景 |
| `@match` | **必填**，尽量收窄 | 避免 `*://*/*` |
| `@grant` | **必填** | 无 GM 用 `none`；有 `@config` 用 `GM_getValue` |
| `@run-at` | 推荐 | 见下表 |
| `@inject-into` | 按需 | iframe 内 DOM 操作用 `all-frames` |
| `@namespace` | 推荐 | `heyteago-tools` 或 `http://tampermonkey.net/` |

### `@run-at` 选用

| 值 | 适用场景 |
|----|----------|
| `document-start` | 尽早执行（如拦截 `prompt`、重定向） |
| `document-end` | DOM 已解析，多数 UI 增强 |
| `document-idle` | 等待页面较空闲（如 `devops-focus`） |

### `@inject-into all-frames`

目标页面的关键 DOM 在 **iframe** 内时声明（如 `devops-bk`、`devops-focus`）。未声明时 Ctool 默认只注入主框架。

---

## 代码结构

```javascript
// ==UserScript==
// ...
// ==/UserScript==

(function () {
    'use strict';

    const LOG_PREFIX = '[my-script]';
    // ...
})();
```

- 使用 **IIFE** + `'use strict'`，避免污染页面全局  
- 魔法字符串、URL、延迟等提为 **`const`**（大写蛇形或驼峰均可，保持一致）  
- 日志建议带前缀，便于在控制台过滤（如 `[devops-focus]`）  
- 单文件自包含；避免依赖未在仓库内的外部 bundle

---

## 状态存储选型

```
需要用户填密码/token、由 Ctool 统一管理？
  └─ 是 → @config + GM_getValue（见 config.md）

仅页面 UI 状态（折叠、列表、上次选中项）？
  └─ 是 → localStorage，且 key 按站点隔离

仅防止同会话重复提交？
  └─ 是 → sessionStorage 或内存 flag
```

### localStorage 按站点隔离（推荐）

多域名部署同一脚本时，key 应带 `location.hostname`，避免环境串数据。参考 `rancher.js`：

```javascript
const SITE_KEY = location.hostname;

function storageKey(base) {
    return `${base}:${SITE_KEY}`;
}

localStorage.setItem(storageKey('qn-envs'), JSON.stringify(envs));
```

### GM vs localStorage

| | GM（`@config`） | localStorage |
|--|-----------------|--------------|
| 配置入口 | Ctool「配置」Dialog | 脚本自建 UI |
| 典型用途 | 密码、token | 环境列表、面板展开状态 |
| 跨设备 | 随扩展 storage 同步（同浏览器配置） | 仅当前源 |

---

## 安全

[`generate-index.mjs`](../scripts/generate-index.mjs) 在生成 index 前扫描脚本**正文**（元数据块之外），拦截疑似硬编码凭据，例如：

- `password = '...'`
- `api_key: "..."`
- `secret = '...'`

**规则：敏感值不得出现在仓库代码中**；使用 `@config` 让用户在 Ctool 本地填写。

---

## Ctool 本地验证

Ctool 从 **GitHub raw** 拉取脚本。本地修改后需 **push 到 main** 再在 Ctool 同步，才能测到远程版本。

> **权宜之计：** 未 push 前可在 Ctool 手动「新增脚本」粘贴本地内容调试，但**不要**以此作为发布流程；合并前必须以 catalog 同步结果为准。

### 准备

1. 按 Ctool 文档构建/加载 Chrome 或 Edge 扩展  
2. 在 `chrome://extensions` **重载**扩展（修改 background 后必做）

### 通用脚本（无 `@config`）

| 步骤 | 操作 | 预期 |
|------|------|------|
| 1 | 打开 Ctool → Heytea Userscript | 列表出现目标脚本（自动同步或点「同步清单」） |
| 2 | **启用**脚本 | 确认可信来源警告后开关打开 |
| 3 | 浏览器打开 `@match` 匹配的 URL | — |
| 4 | **硬刷新**页面 | 控制台出现脚本日志或 UI 生效 |

### 含 `@config` 的脚本

在通用流程步骤 2 与 3 之间插入：

| 步骤 | 操作 | 预期 |
|------|------|------|
| 2a | 卡片点击 **「配置」** | 打开配置 Dialog |
| 2b | 填写必填项并保存 | 无校验错误 |
| 3–4 | 同通用流程 | 脚本读到 GM 值并执行（如自动填密） |

### iframe / `all-frames`

若脚本标注 `@inject-into all-frames`，需在**子 frame 对应页面**验证行为（如 DevOps 流水线嵌入页），不仅测顶层页。

### 常见误判

| 现象 | 可能原因 |
|------|----------|
| 以为缺 Chrome 权限 | `@grant none` 的 DOM 操作不需要额外 manifest 权限 |
| 主页面正常、iframe 无效 | 未声明 `@inject-into all-frames` |
| 改了脚本无效果 | 未 push / 未同步 catalog / 未硬刷新匹配页 |
| 配置了密码仍不执行 | `@config` key 与 `GM_getValue` 不一致，或未启用脚本 |

更完整的排错见 Ctool：[Userscript 平台能力边界说明](https://github.com/baiy/Ctool/blob/main/docs/superpowers/specs/2026-06-27-userscript-platform-capabilities-design.md)。

---

## CI

Push / PR 时 GitHub Actions 运行 `npm run check-index`，确保 `index.json` 与根目录脚本元数据一致。本地提交前请自行执行：

```bash
npm run generate-index
npm run check-index
```

---

## 发布前 Checklist

- [ ] `@version` 已递增  
- [ ] `==UserScript==` 必填字段完整，`@match` 范围合理  
- [ ] 无硬编码凭据；需用户填写的项已用 `@config`（见 [config.md](./config.md)）  
- [ ] `npm run generate-index` 已执行  
- [ ] `npm run check-index` 通过  
- [ ] Ctool 扩展中已同步、启用、（如有）配置，并在匹配页验证  
- [ ] iframe 脚本已测 `all-frames` 场景  
- [ ] `README.md` 脚本表与描述仍准确（若新增脚本需更新）

---

## 相关链接

- [@config 与 GM 配置规范](./config.md)  
- [Ctool 仓库](https://github.com/baiy/Ctool)  
- [本仓 index.json](https://github.com/ZHBlue5/heytea-script/blob/main/index.json)
