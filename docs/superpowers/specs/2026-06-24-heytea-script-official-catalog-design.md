# Heytea 官方 Userscript  catalog 设计（ZHBlue5/heytea-script）

## 背景

本地目录 `/Users/heytea/ZHBlue/script/` 维护三份标准 Userscript（`devops-bk.js`、`cls.js`、`rancher.js`），需在 GitHub 统一发布，并作为 Ctool Userscript 管理器的**内置官方源**。

Ctool 已实现 GitHub catalog 同步（`index.json` + raw 脚本拉取，新脚本默认停用）。当前内置源为占位 `HEYTEAGO/ctool-userscripts`，需改为实际远程仓库。

**远程仓库**：[ZHBlue5/heytea-script](https://github.com/ZHBlue5/heytea-script)（当前仅含 LICENSE，脚本待首次 push）

## 目标

- 以 **`ZHBlue5/heytea-script`** 为唯一官方分发仓
- 根目录 Userscript + 自动生成的 `index.json`
- Ctool 内置源指向该仓，用户「同步清单」即可拉取
- rancher 脚本已移除硬编码凭据，可公开托管

## 非目标

- 不修改 Ctool 注入/解析/同步核心逻辑（仅改官方源常量）
- 不自动启用官方脚本
- 不把 `docs/` 纳入 catalog
- 不支持私有仓 token 拉取（v1）

## 已确认决策

| 项 | 选择 |
|----|------|
| 仓库模式 | 单仓官方源（本地开发 = 源，push 即发布） |
| 远程 repo | **`ZHBlue5/heytea-script`**（`https://github.com/ZHBlue5/heytea-script.git`） |
| 分支 | `main` |
| index 维护 | 从 `==UserScript==` 元数据 **自动生成** + CI 校验 |
| rancher 凭据 | 已从脚本删除，三脚本均可公开 |

## 方案选择

采用 **方案 A：单仓 + 本地 generate-index + GitHub Action 校验**。

| 方案 | 说明 | 取舍 |
|------|------|------|
| **A（采用）** | 脚本与 `index.json` 同仓；`npm run generate-index` | 简单、与 Ctool 现有 raw 拉取一致 |
| B | 仅 release tag 时生成 index | 日常 push 易滞后 |
| C | index 在 Ctool 仓维护 | 双仓漂移 |

## 仓库结构

```
heytea-script/                    # 远程 ZHBlue5/heytea-script
├── index.json                    # 生成物，勿手改
├── package.json                  # generate-index / check-index
├── scripts/
│   └── generate-index.mjs        # 扫描根目录 *.js
├── devops-bk.js
├── cls.js
├── rancher.js
├── README.md
├── LICENSE                       # 已有 Apache-2.0
├── docs/                         # 设计文档，不进 catalog
└── .github/workflows/
    └── check-index.yml           # 校验 index 与脚本一致
```

### Catalog 收录规则

- 仅**仓库根目录** `*.js`（排除 `scripts/` 等子目录）
- `id` = 文件名去掉 `.js`（如 `devops-bk.js` → `devops-bk`）
- raw URL 模板：

```
https://raw.githubusercontent.com/ZHBlue5/heytea-script/main/{filename}
```

### 初始 catalog 条目

| id | 文件 | @version |
|----|------|----------|
| `cls` | `cls.js` | 1.0.1 |
| `devops-bk` | `devops-bk.js` | 1.0.3 |
| `rancher` | `rancher.js` | 3.2.6 |

## index.json 格式

与 Ctool `CatalogIndex` 一致：

```json
{
  "version": 1,
  "scripts": [
    {
      "id": "devops-bk",
      "name": "DevOps BK — 变更弹窗增强",
      "description": "变更弹窗：radio 默认选中 + 复制/新标签页打开 SCC 链接",
      "url": "https://raw.githubusercontent.com/ZHBlue5/heytea-script/main/devops-bk.js",
      "version": "1.0.3"
    }
  ]
}
```

- 顶层 `version`：catalog schema 版本，固定 `1`
- 条目 `version`：来自脚本 `@version`
- 生成器按 `id` 字母序输出

### generate-index 行为

1. 读取根目录 `*.js`
2. 解析 `==UserScript==`：`@name` 必填；读取 `@description`、`@version`
3. 构造 `url`（`ZHBlue5/heytea-script` + `main` + 文件名）
4. 写入 `index.json`
5. 可选：扫描 `password` / `api[_-]?key` 等简单 secret 模式，命中则 exit 1

### npm scripts（package.json）

```json
{
  "scripts": {
    "generate-index": "node scripts/generate-index.mjs",
    "check-index": "node scripts/generate-index.mjs --check"
  }
}
```

`--check`：生成预期 index 与磁盘 `index.json` 比对，不一致则失败。

## 发布流程

```
编辑 *.js → 更新 @version
    → npm run generate-index
    → git commit（含 index.json）
    → git push origin main
    → Ctool Userscript「同步清单」
```

### 本地与远程首次对接

本地目录 `~/ZHBlue/script` 尚未 git 化时：

```bash
cd ~/ZHBlue/script
git init
git remote add origin https://github.com/ZHBlue5/heytea-script.git
npm run generate-index
git add .
git commit -m "feat: initial userscripts and catalog index"
git push -u origin main
```

若远程已有 LICENSE  commit，需 `git pull --rebase origin main` 后再 push。

## Ctool 集成

更新内置官方源常量（3 处对齐）：

| 常量字段 | 值 |
|----------|-----|
| `repo` | `ZHBlue5/heytea-script` |
| `branch` | `main` |
| `indexPath` | `index.json` |
| `label` | `Heytea 官方脚本`（或 `ZHBlue5 官方脚本`） |

**文件：**

- `packages/ctool-core/src/tools/heytea/userscript/userscriptTypes.ts` — `BUILTIN_CATALOG_SOURCE`
- `packages/ctool-adapter/chrome/resources/userscript-background.js` — 内联 `BUILTIN_CATALOG_SOURCE`
- `packages/ctool-core/src/tools/heytea/web_bridge/userscriptHandler.ts` — 通过 import 跟随 types

同步 URL 示例：

```
https://raw.githubusercontent.com/ZHBlue5/heytea-script/main/index.json
```

用户行为不变：同步 → 新脚本 `enabled: false` → 手动启用。

## 安全

- rancher：无硬编码账号密码；`DEFAULT_ENVS` 为集群/NS 配置，随公开脚本分发
- 发布前：`generate-index` 或 CI 做简单 secret 扫描
- 仅 HTTPS raw URL

## CI（check-index.yml）

触发：`push` / `pull_request` → `main`

步骤：

1. `npm run check-index`
2. （可选）确认根目录 `.js` 均出现在 index 中

## 测试计划

| 项 | 方式 |
|----|------|
| 生成器 | 对三份脚本跑 `generate-index`，断言 id/name/version/url |
| check-index | 改脚本不更新 index → `--check` 失败 |
| 远程 | push 后浏览器打开 raw `index.json` 与三个 `.js` 可访问 |
| Ctool | 改常量 → 同步 → 3 条脚本、默认停用 → 启用后在 `@match` 页验证 |

## 实现顺序建议

1. `heytea-script` 仓：`generate-index.mjs`、`package.json`、首次 `index.json`
2. `README.md`、`.github/workflows/check-index.yml`
3. git init + push 至 [ZHBlue5/heytea-script](https://github.com/ZHBlue5/heytea-script)
4. Ctool：更新 `BUILTIN_CATALOG_SOURCE` 三处
5. Ctool 联调同步与注入
