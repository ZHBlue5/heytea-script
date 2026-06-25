# Rancher 快速导航 UI — 可拖动与可隐藏设计

**日期：** 2026-06-17  
**状态：** 已实现（v3.2）  
**文件：** `rancher.js`（Tampermonkey 油猴脚本 v3.0）

## 背景

`rancher.js` 在 Rancher 控制台注入右下角固定悬浮按钮，用于无刷新切换集群和命名空间。当前按钮位置写死（`right: 20px; bottom: 20px`），始终可见，可能与 Rancher 原生 UI 重叠。

## 目标

在保持现有导航功能不变的前提下，为悬浮 UI 增加：

1. **可拖动** — 通过专用拖动手柄移动按钮位置
2. **可隐藏** — 支持点击隐藏图标或拖到屏幕边缘自动收起
3. **边缘恢复** — 隐藏后显示边缘细条标签，点击恢复
4. **状态持久化** — 位置和隐藏状态通过 `localStorage` 跨刷新保持

## 约束

- `@grant none`，不能使用 `GM_setValue` 等油猴 API
- 持久化仅使用 `localStorage`
- 单文件实现，不拆分项目结构
- 不改变现有 `navigate()` / `setNamespace()` 核心逻辑
- `CONFIG.envs` 为手工维护的环境列表，**后续会持续新增**，UI 不得写死条目数量

## 方案选择

采用 **方案 A：单容器 + `left/top` 定位**。

| 方案 | 描述 | 结论 |
|------|------|------|
| A（选用） | `.qn-wrap` 容器统一控制位置，菜单跟随 | 改动小、逻辑清晰 |
| B | `transform: translate` 定位 | 过度设计，收益有限 |
| C | 按钮与边缘标签拆成独立元素 | 状态同步复杂 |

## 架构

在 `rancher.js` 内新增三个逻辑模块（仍单文件）：

| 模块 | 职责 |
|------|------|
| `UIState` | 读写 `localStorage`，管理位置、隐藏状态、贴边方向 |
| `PositionManager` | 容器定位、边缘吸附计算、菜单相对定位 |
| `Interaction` | 拖动手柄事件、隐藏按钮、边缘标签点击恢复 |

### 持久化数据结构

**Key：** `qn-ui-state`

```json
{
  "x": 1820,
  "y": 900,
  "hidden": false,
  "edge": null
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `x` | number | 容器左上角 X 坐标（px） |
| `y` | number | 容器左上角 Y 坐标（px） |
| `hidden` | boolean | 是否处于隐藏/贴边状态 |
| `edge` | `"left"` \| `"right"` \| `"top"` \| `"bottom"` \| `null` | 贴边方向；非隐藏时为 `null` |

- 无 storage 记录时，默认位置等价于 `right: 20px; bottom: 20px`
- `hidden: true` 时根据 `edge` 显示对应边缘细条

## UI 结构

```
.qn-wrap（fixed 容器，统一控制位置）
├── .qn-drag-handle（顶部拖动手柄，仅此处可拖）
├── .qn-btn（主按钮，点击开/关菜单）
│   └── .qn-hide-btn（右上角 × 按钮，点击隐藏）
├── .qn-menu（环境列表，相对容器定位）
└── .qn-tab（隐藏态边缘细条，默认不可见）
```

### 视觉规格

| 元素 | 规格 |
|------|------|
| `.qn-drag-handle` | 按钮顶部 8px 高半透明横条，`cursor: grab` |
| `.qn-hide-btn` | 12×12px，`×` 图标，hover 时显示 |
| `.qn-tab` | 宽 4px、高 40px 蓝色细条，贴左/右/上/下边缘 |
| `.qn-wrap.collapsed` | 只显示 `.qn-tab`，隐藏按钮和菜单 |

### 样式变更

- 移除 `.qn-btn`、`.qn-menu` 上独立的 `right`/`bottom` 固定定位
- 改为由 `.qn-wrap` 统一 `position: fixed; left; top`
- `.qn-menu` 相对 `.qn-wrap` 定位（默认在按钮上方）

### 环境列表可扩展性（`CONFIG.envs`）

`CONFIG.envs` 是唯一数据源，新增环境时只需在数组中追加 `{ name, cluster, ns }`，无需改 UI 逻辑。

| 要求 | 说明 |
|------|------|
| 动态渲染 | 菜单项继续由 `CONFIG.envs.map()` 生成，禁止硬编码条数或固定高度布局 |
| 菜单限高滚动 | `.qn-menu` 设置 `max-height: min(360px, 60vh)` + `overflow-y: auto`，条目增多时在菜单内滚动 |
| 智能展开方向 | 打开菜单时根据按钮在视口中的位置，自动选择向上或向下展开，避免超出屏幕 |
| 拖动跟随 | 按钮拖动后，菜单展开方向随位置重新计算 |

新增 `envs` 时不需要改动 `UIState`、`PositionManager`、`Interaction` 模块。

## 交互流程

### 拖动

1. 在 `.qn-drag-handle` 上 `mousedown` / `touchstart` 开始拖动
2. 拖动过程中实时更新 `.qn-wrap` 的 `left`/`top`，菜单跟随移动
3. `mouseup` / `touchend` 时：
   - 若距任意屏幕边缘 < 20px → 吸附到该边，`hidden: true`，显示 `.qn-tab`
   - 否则保存当前 `x`/`y`，`hidden: false`
4. 写入 `localStorage`

### 点击隐藏

1. 点击 `.qn-hide-btn`（`stopPropagation` 防止触发菜单）
2. 若菜单已展开，先关闭菜单
3. 计算距最近边缘，设置 `hidden: true` 和对应 `edge`
4. 容器切换为 `.qn-wrap.collapsed`，显示 `.qn-tab`
5. 写入 `localStorage`

### 边缘标签恢复

1. 点击 `.qn-tab`
2. 设置 `hidden: false`，`edge: null`
3. 移除 `.collapsed`，恢复按钮到上次 `x`/`y` 位置
4. 写入 `localStorage`

### 打开菜单（不变）

- 仅点击 `.qn-btn` 主体区域触发 `menu.classList.toggle('show')`
- 拖动手柄和隐藏按钮不触发菜单

## 边界与错误处理

| 场景 | 处理方式 |
|------|----------|
| `localStorage` 不可用 | 降级为默认右下角，每次刷新重置，不抛错 |
| 窗口 resize | 校验 `x`/`y`，超出视口时钳制到可见区域 |
| 拖动手柄与菜单点击冲突 | 手柄和隐藏按钮均 `stopPropagation` |
| 隐藏时菜单已打开 | 隐藏前先 `menu.classList.remove('show')` |
| storage 数据损坏 | 捕获 JSON 解析异常，回退默认值 |

## 测试清单

- [ ] 拖动手柄可自由移动按钮，点击按钮主体仍可开关菜单
- [ ] 拖到左/右/上/下四边均可自动贴边隐藏
- [ ] 点击 × 可隐藏，边缘出现对应方向细条
- [ ] 点击边缘细条可恢复，位置与隐藏前一致
- [ ] 刷新页面后位置和隐藏状态保持不变
- [ ] 选择环境后 `navigate()` 无刷新切换功能正常
- [ ] 窗口 resize 后按钮仍在可见区域内
- [ ] `CONFIG.envs` 追加 10+ 条后菜单可滚动，不撑出视口
- [ ] 按钮靠近屏幕顶部/底部时，菜单自动切换展开方向

## 不在范围内

- 快捷键唤出（用户选择边缘标签方案）
- 长按拖动（用户选择专用手柄方案）
- 多用户/多设备状态同步
- 自动登录逻辑改动

## 版本

实现完成后将 `@version` 从 `3.0` 升至 `3.1`。
