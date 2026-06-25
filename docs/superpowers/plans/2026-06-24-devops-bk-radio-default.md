# DevOps BK — Radio 默认选中 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or inline execution.

**Goal:** 变更弹窗第一个必填 radio 组在无选中时自动选中第一项。

**Architecture:** 在 `processDialog` 中调用 `defaultFirstRadio`，复用现有 DialogWatcher。

**Spec:** [2026-06-24-devops-bk-radio-default-design.md](../specs/2026-06-24-devops-bk-radio-default-design.md)

---

### Task 1: 实现 defaultFirstRadio

**Files:** Modify `devops-bk.js`

- [ ] 添加 `defaultFirstRadio(dialogBody)` 函数
- [ ] 在 `processDialog` 开头调用（先于 injectCopyButton）
- [ ] 更新 `@version` 1.0.2、`@description`

**核心代码：**

```javascript
function defaultFirstRadio(dialogBody) {
    const form = dialogBody.querySelector('form');
    if (!form) return;
    const item = form.querySelector('.bk-form-item.is-required');
    if (!item) return;
    const radios = item.querySelectorAll('input[type="radio"]');
    if (!radios.length || [...radios].some(r => r.checked)) return;
    const label = item.querySelector('label');
    if (!label) return;
    label.click();
    if (![...radios].some(r => r.checked)) {
        const first = radios[0];
        first.checked = true;
        first.dispatchEvent(new Event('change', { bubbles: true }));
    }
}
```

```javascript
function processDialog(dialogBody) {
    defaultFirstRadio(dialogBody);
    const found = findPreviewContainer(dialogBody);
    ...
}
```

### Task 2: 验证

- [ ] `node -e` extractUrl 自测仍通过
- [ ] 更新 radio spec 状态为已实现
- [ ] Tampermonkey 手动测试弹窗 radio 自动选中
