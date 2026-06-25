# DevOps BK — Radio 默认选中设计

**日期：** 2026-06-24  
**状态：** 已实现（v1.0.2）  
**文件：** `devops-bk.js`（Tampermonkey 油猴脚本 v1.0.2）  
**关联 spec：** [SCC 链接复制](./2026-06-24-devops-bk-scc-copy-design.md)

## 背景

在 `https://devops-bk.heyteago.com/` 发起变更时，弹窗表单第一个必填项为 radio 组。弹窗打开后该组常无默认选中，用户每次需手动点选第一项，操作重复。

现有 `devops-bk.js`（v1.0.1）已通过 `DialogWatcher` 监听 `.bk-dialog-body` 异步插入及内部内容变化，可复用同一入口处理 radio 默认选中。

## 目标

变更弹窗打开后，若第一个必填 radio 组 **尚未有任何选中项**，自动选中 **第一个 `label`（DOM 顺序）**。

## 约束

- 扩展 `devops-bk.js`，不新建脚本文件
- `@match` 仍为 `https://devops-bk.heyteago.com/*`
- `@grant none`
- 不使用 `body > div:nth-child(13) > ...`  brittle 选择器
- 仅处理表单内 **第一个** `.bk-form-item.is-required` 的 radio 组
- **不覆盖** 用户已选中的项

## 方案选择

采用 **方案 A：扩展现有 `processDialog`**。

| 方案 | 描述 | 结论 |
|------|------|------|
| A（选用） | 在 `processDialog` 中增加 `defaultFirstRadio()`，共用 DialogWatcher | 复用异步弹窗逻辑，无重复监听 |
| B | 独立 MutationObserver | 重复、浪费 |
| C | 固定 nth-child 选择器 | 页面改版易失效 |

## 架构

在 `devops-bk.js` 内新增一个逻辑块：

| 模块 | 职责 |
|------|------|
| `defaultFirstRadio(dialogBody)` | 定位第一个必填 radio 组，无选中时点击第一个 label |

### 数据流

```
DialogWatcher 检测到弹窗/内容变化
  → processDialog(dialogBody)
  → defaultFirstRadio(dialogBody)   ← 新增
  → injectCopyButton(...)         ← 已有
```

### DOM 定位规则

```
.bk-dialog-body form
  → querySelector('.bk-form-item.is-required')   // 第一个必填项
  → querySelector('label')                        // 第一个 label
```

### 选中逻辑

1. 在必填项容器内查找 `input[type="radio"]`
2. 若任一 `input.checked === true` → **跳过**（不覆盖用户选择）
3. 若无选中 → 点击第一个 `label`（优先触发 BK 组件状态）
4. 点击后若仍无 `checked` → fallback：`input.checked = true` + `dispatchEvent(new Event('change', { bubbles: true }))`

### 重试策略

- **不使用** `data-*`「已处理」标记（表单可能异步渲染，需允许多次 `processDialog` 重试）
- 跳过条件仅为「已有 radio 被 checked」

## 脚本元数据变更

| 字段 | 变更 |
|------|------|
| `@version` | `1.0.1` → `1.0.2` |
| `@description` | 补充 radio 默认选中能力说明 |

## 错误处理

| 场景 | 处理 |
|------|------|
| 弹窗内无 form / 无必填项 | 静默跳过 |
| 必填项内无 radio | 静默跳过 |
| 已有选中项 | 跳过 |
| 第一个 label 不存在 | 跳过 |
| 点击后仍未 checked | fallback 设 checked + 触发 change |

## 测试计划

1. 打开变更弹窗 → 第一个必填 radio 组自动选中第一项
2. 手动改选其他项 → 不再被脚本改回
3. 关闭弹窗再打开（无选中态）→ 再次自动选中第一项
4. 弹窗异步加载 radio → 内容出现后仍能自动选中
5. 不影响已有「复制 SCC 链接」按钮功能

## 不在范围内

- 其他必填项 / 非必填项的 radio 默认选中
- 按文案匹配（如 PROD）
- 每次弹窗打开强制重置为第一项
- 新建独立油猴脚本
