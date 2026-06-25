# Rancher 快速导航 — 环境配置管理设计

**日期：** 2026-06-17  
**状态：** 已实现（v3.2）  
**文件：** `rancher.js`（Tampermonkey 油猴脚本）  
**关联 spec：** [UI 可拖动与可隐藏](./2026-06-17-rancher-ui-float-hide-design.md)

## 背景

当前 `CONFIG.envs` 将环境列表硬编码在油猴脚本中。每次新增环境需编辑脚本并重新保存，且需手工填写不直观的 `cluster` ID（如 `c-m-8sbspbn8`）。随着环境增多，平铺列表也难以快速定位常用项。

## 目标

将环境配置从脚本硬编码迁移为浏览器端可管理的数据，满足：

1. **不改脚本即可增删** — 通过 UI 管理环境列表
2. **无需手填 cluster ID** — 收藏当前页或下拉选择，自动写入 ID
3. **条目多了好找** — 置顶 + 拖拽排序，不使用搜索框

## 约束

- `@grant none`，持久化仅使用 `localStorage`
- 单文件实现，不拆分项目结构
- 不改变现有 `navigate()` / `setNamespace()` 核心逻辑
- 与 UI 悬浮/隐藏 spec 兼容：菜单支持 `max-height` 内部滚动

## 方案选择

采用 **方案 A：localStorage 收藏 + 页内管理**。

| 方案 | 描述 | 结论 |
|------|------|------|
| A（选用） | localStorage 存储 + 菜单内收藏/表单/置顶/排序 | 满足全部诉求，兼容 `@grant none` |
| B | 改 `@grant` 使用 `GM_setValue` | 收益小，增加权限 |
| C | 外部 JSON 远程加载 | 非团队共享场景，过度设计 |

## 架构

在 `rancher.js` 内新增两个模块：

| 模块 | 职责 |
|------|------|
| `EnvStore` | `localStorage` 读写、种子导入、排序、去重 |
| `EnvManager` | 收藏当前、手动表单、置顶/删除/拖拽 UI |

### 数据模型

**Storage key：** `qn-envs`

```json
{
  "envs": [
    {
      "id": "a1b2c3",
      "name": "Go开发",
      "clusterId": "c-m-8sbspbn8",
      "clusterName": "dev-ack",
      "ns": "dev-go-1",
      "pinned": true,
      "order": 0
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一标识，使用 `crypto.randomUUID()` |
| `name` | string | 显示名称，用户可编辑 |
| `clusterId` | string | 导航用集群 ID，自动写入，用户不手填 |
| `clusterName` | string | 展示用集群名称，收藏/表单时从 store 读取 |
| `ns` | string | 命名空间 |
| `pinned` | boolean | 是否置顶 |
| `order` | number | 排序权重，越小越靠前 |

### 排序规则

1. `pinned: true` 的条目排在前面
2. 同组内按 `order` 升序
3. 置顶区与普通区之间用分隔线区分

### 种子数据

将现有 `CONFIG.envs` 重命名为 `DEFAULT_ENVS`，仅在 `localStorage` 无数据时导入一次：

```javascript
const DEFAULT_ENVS = [
    { name: 'Go开发', cluster: 'c-m-8sbspbn8', ns: 'dev-go-1' },
    // ... 现有 7 条
];
```

导入时自动补充 `id`、`clusterName`（空字符串）、`pinned: false`、`order`（按数组索引）。

## UI 设计

### 菜单结构

```
┌─────────────────────────┐
│ 📌 置顶                  │
│  ≡ Go开发          ★ ✕  │
│  ≡ 生产            ★ ✕  │
├─────────────────────────┤
│  ≡ agent开发        ☆ ✕  │
│  ≡ 测试Go1          ☆ ✕  │
│  ...（可滚动）           │
├─────────────────────────┤
│ ⭐ 收藏当前  ＋ 添加      │
└─────────────────────────┘
```

| 控件 | 行为 |
|------|------|
| `≡` 拖拽手柄 | 拖动调整 `order`，松手后保存 |
| `★` / `☆` | 点击切换 `pinned` |
| `✕` | 删除，需二次确认 |
| `⭐ 收藏当前` | 读取当前 cluster/NS 并添加 |
| `＋ 添加` | 展开手动表单面板 |

### 收藏当前

1. 用户在 Rancher 切换到目标集群和命名空间
2. 点击「收藏当前」
3. 从 `$nuxt.$store` 读取：
   - `clusterId` ← `store.getters['clusterId']`
   - `clusterName` ← 集群元数据（如 `store.state.cluster?.name`）
   - `ns` ← 从 `store.state.namespaceFilters` 解析当前 NS
4. 弹出轻量输入框填写别名（默认值：`clusterName/ns`）
5. 去重检查：同 `clusterId + ns` 已存在则提示，不重复添加
6. 写入 `localStorage`，刷新菜单

`$nuxt` 未就绪时，「收藏当前」按钮 disabled，显示 tooltip「请等待页面加载」。

### 手动表单

点击「＋ 添加」展开内联面板：

| 字段 | 控件 | 数据来源 |
|------|------|----------|
| 名称 | 文本输入 | 用户填写 |
| 集群 | 下拉选择 | `$nuxt.$store` 集群列表，显示名称、存储 ID |
| 命名空间 | 下拉选择 | 随所选集群联动，从 store 读取 |

保存后写入 `localStorage`，关闭面板，刷新菜单。

### 菜单可扩展性

- 列表由 `EnvStore.getSorted()` 动态渲染，禁止硬编码条数
- `.qn-menu` 设置 `max-height: min(360px, 60vh)` + `overflow-y: auto`
- 管理区（底部按钮）固定在菜单底部，列表区独立滚动

## 与现有代码的变更

| 项目 | 变更 |
|------|------|
| `CONFIG.envs` | 重命名为 `DEFAULT_ENVS`，仅作种子 |
| `createUI()` | 调用 `EnvStore` 动态渲染列表，委托 `EnvManager` 处理交互 |
| `navigate()` | 不变 |
| `setNamespace()` | 不变 |
| `CONFIG.username/password` | 不变（与 env 配置无关） |

## 边界与错误处理

| 场景 | 处理方式 |
|------|----------|
| `$nuxt` 未就绪 | 收藏/表单按钮 disabled |
| 重复收藏 | 提示「该环境已存在」，不重复添加 |
| 集群/NS 已被 Rancher 删除 | 条目仍保留显示，点击走现有导航超时逻辑；用户可手动删除 |
| `localStorage` 不可用 | 降级为内存态，console 警告，刷新后丢失 |
| JSON 解析失败 | 回退 `DEFAULT_ENVS` 种子重新导入 |
| 拖拽与菜单点击冲突 | 拖拽手柄 `stopPropagation` |

## 测试清单

- [ ] 首次安装：`DEFAULT_ENVS` 7 条自动导入
- [ ] 收藏当前：正确捕获 clusterId、clusterName、ns
- [ ] 收藏去重：同 clusterId+ns 提示已存在
- [ ] 手动表单：集群/NS 下拉联动正确
- [ ] 置顶切换：置顶区与普通区分开显示
- [ ] 拖拽排序：顺序持久化
- [ ] 删除：二次确认后移除并持久化
- [ ] 刷新页面后列表、排序、置顶保持不变
- [ ] 点击环境条目 `navigate()` 无刷新切换正常
- [ ] 10+ 条目时菜单内部可滚动，底部管理按钮始终可见

## 不在范围内

- 团队共享 / 远程配置同步
- 搜索过滤
- 环境分组（按集群折叠展示）
- 跨浏览器/跨设备同步
- 自动登录逻辑改动

## 版本

实现完成后将 `@version` 从 `3.0` 升至 `3.2`（UI 悬浮为 v3.1，env 配置为 v3.2；若合并实现则统一升版）。
