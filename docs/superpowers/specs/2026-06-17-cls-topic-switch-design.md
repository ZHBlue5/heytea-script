# 腾讯云 CLS Topic 快速切换 — 设计文档

**日期：** 2026-06-17  
**状态：** 已实现（v1.0.0）  
**文件：** `cls.js`（Tampermonkey 油猴脚本 v1.0.0）  
**参考：** [rancher.js](../../../rancher.js) 交互与架构

## 背景

腾讯云 CLS 日志检索页 URL 中包含 `topic_id`、`region` 等参数。日常排查需在多个日志主题间切换，手动改 URL 或控制台内层层点击效率低。

目标 URL 示例：

```
https://console.cloud.tencent.com/cls/search
  ?hideLeftNav=true&hideTopNav=true&hideHeader=true
  &time=now-15m,now&timeZone=browser&topicType=log&multiple=false
  &region=ap-guangzhou
  &topic_id=bf887d9e-0cdc-42f5-8a8f-89c29990c756
  &analysis=eyJ0eXBlIjoidGFibGUifQ&queryBase64=&disabledRanges=W10
```

## 目标

新建独立油猴脚本 `cls.js`，在 CLS 检索页提供：

1. **快速切换 topic** — 点击列表项切换 `topic_id` + `region`
2. **保留其他 URL 参数** — `time`、`queryBase64`、`hideLeftNav` 等不变
3. **Topic 可管理** — 种子数据 + 收藏当前 + 手动添加，置顶排序
4. **交互对齐 rancher** — 悬浮球、拖动、隐藏、贴边恢复（独立实现，不共用代码）

## 约束

- `@grant none`，持久化仅 `localStorage`
- 单文件 `cls.js`，不 `@require` rancher
- Storage key 使用 `cls-` 前缀，避免与 `qn-`（rancher）冲突
- `@match` 限定 `https://console.cloud.tencent.com/cls/search*`

## 方案选择

采用 **方案 A：独立 cls.js，架构对齐 rancher.js**。

| 方案 | 描述 | 结论 |
|------|------|------|
| A（选用） | 独立 cls.js，UI/存储模式复用 rancher 设计 | 满足全部诉求 |
| B | 抽公共 ui-core.js | 违背独立文件要求 |
| C | 浏览器书签 | 无管理能力 |

## 架构

| 模块 | 职责 |
|------|------|
| `TopicStore` | `localStorage` 读写、种子导入、排序、去重 |
| `TopicManager` | 收藏、表单、置顶/删除/拖拽 UI |
| `UIState` | 悬浮按钮位置、隐藏状态持久化 |
| `PositionManager` | 定位、贴边、菜单 `fixed` 计算 |
| `switchTopic()` | URL 构建、pushState、降级刷新 |

### 数据模型

**Storage key：** `cls-topics`

```json
{
  "topics": [
    {
      "id": "a1b2c3",
      "name": "广州-示例主题",
      "topicId": "bf887d9e-0cdc-42f5-8a8f-89c29990c756",
      "region": "ap-guangzhou",
      "pinned": false,
      "order": 0
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | `crypto.randomUUID()` |
| `name` | string | 显示名称 |
| `topicId` | string | CLS `topic_id` 参数值 |
| `region` | string | CLS `region` 参数值 |
| `pinned` | boolean | 是否置顶 |
| `order` | number | 排序权重 |

**UI 状态 key：** `cls-ui-state`（结构同 rancher `qn-ui-state`）

### 种子数据

```javascript
const DEFAULT_TOPICS = [
    {
        name: '广州-示例主题',
        topicId: 'bf887d9e-0cdc-42f5-8a8f-89c29990c756',
        region: 'ap-guangzhou'
    }
];
```

仅在 `localStorage` 无数据时导入一次。

## 切换逻辑（`switchTopic`）

### URL 构建

1. `const url = new URL(location.href)`
2. `url.searchParams.set('topic_id', topicId)`
3. `url.searchParams.set('region', region)`
4. 不修改其他 searchParams

### 无刷新优先（方案 C）

```
1. history.pushState(null, '', newUrl)
2. dispatch PopStateEvent('popstate')
3. dispatch HashChangeEvent('hashchange')（兼容）
```

### 降级刷新

| 条件 | 处理 |
|------|------|
| `pushState` 抛错 | 立即 `location.assign(newUrl)` |
| 800ms 内无成功信号 | `location.assign(newUrl)` |

**成功信号：** `PerformanceObserver` 监听 `resource`/`fetch` 类型条目，URL 包含新 `topicId` 则视为 CLS 已响应，取消降级定时器。

切换进行中禁用重复点击，防止并发切换。

## UI 设计

对齐 rancher v3.2.6，独立 CSS 类名前缀 `cls-`（避免与 rancher `qn-` 冲突）：

| 组件 | 说明 |
|------|------|
| `.cls-wrap` | 悬浮容器，固定定位 |
| `.cls-toolbar` | 左侧拖动/隐藏工具条，悬停热区 + 280ms 延迟 |
| `.cls-btn` | 主按钮（日志图标） |
| `.cls-menu` | `position: fixed` 菜单，挂 `document.body` |
| `.cls-tab` | 贴边隐藏标签，32×80 点击区 |

### 菜单结构

```
┌─────────────────────────┐
│ 📌 置顶                  │
│  ≡ 广州-示例    ★ ✕      │
│     ap-guangzhou         │
├─────────────────────────┤
│  ≡ ...                   │
├─────────────────────────┤
│ ⭐ 收藏当前  ＋ 添加      │
└─────────────────────────┘
```

列表项副标题显示 `region`。

### Topic 管理

| 操作 | 行为 |
|------|------|
| 收藏当前 | 从 `URLSearchParams` 读 `topic_id`、`region`，弹窗填名称 |
| 手动添加 | 名称 + topicId 文本 + region 下拉（常用地域 + 自定义输入） |
| 去重 | 同 `topicId + region` 不重复添加 |
| 置顶/排序/删除 | 同 rancher |

常用地域下拉预设：`ap-guangzhou`、`ap-shanghai`、`ap-beijing`、`ap-nanjing`、`ap-hongkong`，支持手动输入其他值。

## 边界与错误处理

| 场景 | 处理 |
|------|------|
| URL 无 `topic_id` | 收藏按钮 disabled |
| 重复收藏 | 提示「该主题已存在」 |
| `pushState` 后 CLS 不响应 | 800ms 后 `location.assign` |
| `localStorage` 不可用 | 内存降级 + console 警告 |
| JSON 解析失败 | 回退种子重新导入 |
| 与 rancher 同开 | storage key 隔离，互不影响 |

## 测试清单

- [ ] 点击 topic：`topic_id`、`region` 正确， `time`/`queryBase64` 等保留
- [ ] pushState 成功时无整页刷新（或仅数据区刷新）
- [ ] pushState 无效时 800ms 内自动整页刷新
- [ ] 收藏当前、手动添加、去重正常
- [ ] 置顶、拖拽排序、删除持久化
- [ ] 拖动、隐藏、贴边恢复、大标签可点击
- [ ] 与 rancher.js 同时启用无冲突

## 不在范围内

- 修改 `queryBase64` 检索语句
- 跨账号/团队共享 topic 配置
- 非 `cls/search` 页面（如仪表盘、告警）
- 自动登录腾讯云

## 版本

初始版本 `1.0.0`。
