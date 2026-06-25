# Rancher 快速导航 — 按网站独立存储设计

**日期：** 2026-06-27  
**状态：** 待实现  
**文件：** `rancher.js`（Userscript / heytea-script catalog）  
**关联 spec：** [环境配置管理](./2026-06-17-rancher-env-config-design.md)、[UI 可拖动与可隐藏](./2026-06-17-rancher-ui-float-hide-design.md)

## 背景

`rancher.js` 匹配三个 Rancher 域名，共用全局 `localStorage` key（`qn-envs`、`qn-ui-state`）。不同实例的 cluster ID 不同，环境列表与 UI 状态会串站，导致导航到无效 cluster 或布局混乱。

## 目标

- 环境列表（`EnvStore`）与 UI 状态（`UIState`）**按 `location.hostname` 隔离**
- 升级用户：旧 global key **一次性迁移**到当前 hostname 后删除
- 新站点/无数据站点：**空环境列表**，用户通过「收藏当前」或手动表单添加

## 非目标

- 不使用 GM 存储 / Ctool GM 配置
- 不做跨站点同步、导入导出
- 不修改 `@match`、导航、`@grant none` 约束
- 不为各 hostname 维护不同 `DEFAULT_ENVS` 种子

## 已确认决策

| 项 | 选择 |
|----|------|
| 隔离范围 | 环境列表 + UI 状态 |
| 站点标识 | `location.hostname` |
| Key 方案 | 后缀式 `qn-envs:{hostname}` / `qn-ui-state:{hostname}` |
| 旧数据迁移 | 复制到当前 hostname 后删除 global key |
| 无 per-site 数据 | 空列表，不自动 seed |

---

## Storage Key 格式

```javascript
const ENVS_KEY = 'qn-envs';
const UI_STATE_KEY = 'qn-ui-state';
const SITE_KEY = location.hostname;

function storageKey(base) {
    return `${base}:${SITE_KEY}`;
}
```

| 站点 | 环境 key 示例 | UI key 示例 |
|------|---------------|-------------|
| `rancher.heyteago.com` | `qn-envs:rancher.heyteago.com` | `qn-ui-state:rancher.heyteago.com` |
| `rancher.lan.heytea.com` | `qn-envs:rancher.lan.heytea.com` | … |
| `rancher.lan.heytea-co.com` | `qn-envs:rancher.lan.heytea-co.com` | … |

`EnvStore.load()` / `save()` 与 `UIState.load()` / `save()` 全部改用 `storageKey(...)`，禁止再读写裸 `qn-envs` / `qn-ui-state`。

---

## 迁移逻辑

在 `createUI()` 调用 `EnvStore.load()` / `UIState.load()` **之前**执行 `migrateLegacyStorage()`：

```javascript
function migrateLegacyStorage() {
    const envScoped = storageKey(ENVS_KEY);
    const uiScoped = storageKey(UI_STATE_KEY);

    try {
        const legacyEnvs = localStorage.getItem(ENVS_KEY);
        if (legacyEnvs !== null && localStorage.getItem(envScoped) === null) {
            localStorage.setItem(envScoped, legacyEnvs);
            localStorage.removeItem(ENVS_KEY);
        }
    } catch (e) {
        console.warn('[QN] envs 迁移失败', e);
    }

    try {
        const legacyUi = localStorage.getItem(UI_STATE_KEY);
        if (legacyUi !== null && localStorage.getItem(uiScoped) === null) {
            localStorage.setItem(uiScoped, legacyUi);
            localStorage.removeItem(UI_STATE_KEY);
        }
    } catch (e) {
        console.warn('[QN] ui-state 迁移失败', e);
    }
}
```

**行为说明：**

- 旧 global 数据只迁到**升级后首次访问**的 hostname
- 其余 hostname 无 legacy 可复制 → 空 env 列表 + 默认 UI 位置
- 迁移后 global key 已删除，避免再次误读

---

## EnvStore 变更

### 移除自动 seed

- 删除 `_seed()` 在 `load()` 无数据时的调用
- `load()` 无有效 JSON 或 `envs` 非数组 → `_envs = []`，不写入
- `DEFAULT_ENVS` 常量删除（或移入注释，不参与运行时）

### load / save

```javascript
load() {
    try {
        const raw = localStorage.getItem(storageKey(ENVS_KEY));
        if (raw) {
            const data = JSON.parse(raw);
            if (Array.isArray(data.envs)) {
                this._envs = data.envs;
                return;
            }
        }
    } catch (e) {
        console.warn('[QN] envs 解析失败，使用空列表', e);
    }
    this._envs = [];
},

save() {
    if (!this._storageOk) return;
    try {
        localStorage.setItem(storageKey(ENVS_KEY), JSON.stringify({ envs: this._envs }));
    } catch (e) { /* 现有降级逻辑 */ }
},
```

### 空列表 UI

- 菜单无条目时仍显示底部「收藏当前 / 添加」
- 无需新增空态文案（可选 v2：「暂无环境，请收藏当前页」）

数据模型字段不变（`id`, `name`, `clusterId`, `clusterName`, `ns`, `pinned`, `order`）。

---

## UIState 变更

`load()` / `save()` 改用 `storageKey(UI_STATE_KEY)`；解析失败时仍使用默认右下角位置。字段不变（`x`, `y`, `hidden`, `edge`）。

---

## 初始化顺序

```javascript
function createUI() {
    if (document.querySelector('.qn-wrap')) return;

    migrateLegacyStorage();
    EnvStore.load();
    UIState.load();
    // … 其余不变
}
```

---

## 版本

实现完成后 `@version` 从 `3.2.6` 升至 **`3.3.0`**（localStorage key schema 变更）。

升级 catalog 后运行 `npm run generate-index` 更新 `index.json`。

---

## 边界与错误处理

| 场景 | 处理 |
|------|------|
| `localStorage` 不可用 | 现有 `_storageOk` 内存降级，刷新丢失 |
| JSON 解析失败 | env → 空列表；ui → 默认位置 |
| 同 hostname 已有 scoped key | 跳过迁移，不覆盖 |
| legacy key 存在但 scoped 也存在 | 不迁移 legacy（以 scoped 为准），可选手动清理 legacy |

---

## 测试清单

- [ ] `rancher.heyteago.com` 与 `rancher.lan.heytea.com` 各自 env 列表互不影响
- [ ] 各站点 UI 位置/折叠状态独立
- [ ] 从 v3.2.6 升级：首次访问站点 A 继承旧 global env + ui，global key 已删
- [ ] 从未有过数据的站点 B：空 env，可「收藏当前」并持久化
- [ ] 刷新后 per-hostname 数据保持
- [ ] 导航、置顶、拖拽、删除仍正常

---

## 不在范围内（v2）

- 按 hostname 配置不同默认种子
- 跨站点导入/导出 env 列表
- GM / Ctool 统一配置存储
