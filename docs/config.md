# @config 与 GM 配置规范

本文说明如何在 Heytea 官方脚本中声明用户可配置项，并通过 Ctool Userscript 管理器写入与读取。

**目标运行时：** [Ctool](https://github.com/baiy/Ctool) Chrome/Edge 扩展（非 Tampermonkey 独立安装）。

---

## 概述

- **`@config`**：在 `==UserScript==` 元数据块中声明配置字段 schema。
- **存储：** Ctool 将值写入 GM 存储（`chrome.storage.local`，键名 `gm:{scriptId}:{key}`）。
- **读取：** 脚本运行时调用 `GM_getValue(key, defaultValue)`，**`key` 必须与 `@config` 声明一致**。
- **配置入口：** Ctool → Heytea Userscript → 脚本卡片 **「配置」**（需扩展环境；Web 端仅管理，不注入）。

解析规则的权威实现：Ctool [`userscriptParser.ts`](https://github.com/baiy/Ctool/blob/main/packages/ctool-core/src/tools/heytea/userscript/userscriptParser.ts)。

---

## 语法

可重复多行：

```
// @config <key> <type> <label...> [required]
```

| 部分 | 说明 |
|------|------|
| `key` | GM 键名，仅允许 `[a-zA-Z0-9_-]+` |
| `type` | 见下表 |
| `label` | 配置 Dialog 中的显示标签（可含空格） |
| `required` | 可选末尾 token；存在则保存时必填 |

**示例（本仓 `ali-log.js` / `tencent-cls.js`）：**

```javascript
// @grant        GM_getValue
// @config       password secret 内部登录密码 required
```

---

## 类型对照表

| type | Ctool 配置 UI | GM 存储类型 | 脚本读取示例 |
|------|---------------|-------------|--------------|
| `string` | 单行文本 | `string` | `GM_getValue('name', '')` |
| `secret` | 密码框（掩码） | `string` | `GM_getValue('password', '')` |
| `number` | 数字输入 | `number` | `GM_getValue('timeout', 3000)` |
| `boolean` | 开关 | `boolean` | `GM_getValue('enabled', false)` |
| `json` | JSON 文本域（校验 parse） | `object` / `array` | `GM_getValue('options', {})` |

> **`secret` 与 `string`：** 仅 UI 展示差异，存储均为 string。密码、token 一律使用 `secret`。

---

## 配套 `@grant`

| 场景 | 声明 |
|------|------|
| 仅读取用户配置 | `// @grant GM_getValue` |
| 脚本内写入 GM（本仓少见） | 另加 `GM_setValue` |

有 `@config` 但未声明 `GM_getValue` 时，Ctool 可能不显示「配置」入口，且运行时无法读值。

---

## 运行时约定

### 1. key 与 `@config` 一致

```javascript
// @config password secret 内部登录密码 required
const password = GM_getValue('password', '');  // ✅
const password = GM_getValue('pwd', '');       // ❌ key 不一致
```

### 2. `required` 字段：早退 + 清晰日志

用户未在 Ctool 填写时，脚本应**停止敏感逻辑**，不要 fallback 硬编码默认值：

```javascript
const password = GM_getValue('password', '');
if (!password) {
    console.warn('[tencent-cls] 未配置 password，请在 Ctool Userscript → 配置 中填写');
    return;
}
```

### 3. 不要在脚本体内硬编码凭据

`npm run generate-index` / CI 会扫描疑似硬编码密码、api key 等模式，命中则失败。敏感值必须通过 `@config` + GM。

---

## 本仓参考实现

| 脚本 | `@config` | 说明 |
|------|-----------|------|
| `ali-log.js` | `password secret 内部登录密码 required` | 内部登录页自动填密并跳转 SLS |
| `tencent-cls.js` | `password secret 免登录跳转密码 required` | 覆盖 `prompt` 填密后跳转 CLS |

阅读上述文件头部元数据与 `GM_getValue` 用法即可作为模板。

### 多字段示例（文档用，非现有脚本）

```javascript
// @grant        GM_getValue
// @config       redirectUrl string 跳转 URL
// @config       enabled boolean 启用自动跳转
// @config       options json 高级选项
```

---

## 用户配置路径（Ctool）

1. 安装并重载 Ctool 扩展  
2. 打开 **Heytea Userscript**，同步官方 catalog（打开页自动同步或点「同步清单」）  
3. **启用**目标脚本  
4. 点击卡片 **「配置」**，填写字段并保存  
5. 打开 `@match` 匹配的页面并 **硬刷新**（`Cmd+Shift+R` / `Ctrl+Shift+R`）

已启用脚本在配置变更或 catalog 更新后，通常也需刷新匹配页才能加载新逻辑。

---

## 反模式

| ❌ 不要 | ✅ 应该 |
|---------|---------|
| `const PASSWORD = 'xxx'` | `@config` + `GM_getValue` |
| `@config` 与 `GM_getValue` 的 key 不同 | 保持完全一致 |
| 无 `GM_getValue` grant 却调用 GM | 声明 `@grant GM_getValue` |
| `required` 字段用硬编码兜底 | 未配置则 `return` + `console.warn` |
| 在公开仓库提交真实密码 | 仅在本机 Ctool 配置中填写 |

---

## 相关文档

- [CONTRIBUTING.md](./CONTRIBUTING.md) — 发布流程与 Ctool 完整验证清单  
- Ctool GM 平台设计：[userscript-gm-config-kv-design.md](https://github.com/baiy/Ctool/blob/main/docs/superpowers/specs/2026-06-26-userscript-gm-config-kv-design.md)
