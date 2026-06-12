# Step 12 日志 - 修复指令重复执行 Bug

**时间**: 2026-06-12 18:17
**状态**: ✅ 已完成

---

## 问题描述

输入一个指令（如"画一个雪人"）会重复执行多次，导致画布上出现多个重复图形。

## 根因分析

| 优先级 | 问题 | 文件 | 影响 |
|--------|------|------|------|
| **P0** | `onresult` 和 `onend` 双重触发 `onResult`，同一句话提交两次 | `useSpeechRecognition.js` | 语音输入必定重复 |
| **P0** | `handleUserInput` 无防重入锁 | `App.vue` | 异步 LLM 期间可被再次调用 |
| **P1** | `submitText` 无防重复提交保护 | `ControlPanel.vue` | 快速双击/连按回车时重复 |
| **P2** | `onUnmounted` 未清理 recognition 事件回调 | `useSpeechRecognition.js` | 热更新残留 |

### 触发链路

```
用户说"画一个雪人"
  → onresult(interim: "画")        → onResult → handleUserInput("画")
  → onresult(interim: "画一个")     → onResult → handleUserInput("画一个")
  → onresult(final: "画一个雪人")   → onResult → handleUserInput("画一个雪人") ❌ 第1次
  → onend                         → onResult → handleUserInput("画一个雪人") ❌ 第2次
```

## 修复方案

### 1. `useSpeechRecognition.js` — 回调分离

将原来单一的 `onResult` 回调拆分为三个：

- **`onDisplay`**：实时显示中间结果，仅更新 UI 文本
- **`onFinal`**：识别结束后触发，**唯一执行指令的入口**
- **`onError`**：错误处理

关键改动：
- `onresult` 只调用 `onDisplay()`，不再触发指令执行
- `onend` 通过 `dispatchFinal()` 调用 `onFinal()`，保证只执行一次
- 新增 `finalDispatched` 标志位防重
- `onUnmounted` 中清空 `recognition.onresult/onend/onerror = null`
- 出错时设置 `finalDispatched = true` 防止误提交

### 2. `App.vue` — 防重入锁

- 新增 `isProcessing` ref
- `handleUserInput` 入口检查：`if (isProcessing.value) return`
- 异步 LLM 调用期间 `isProcessing = true`，`finally` 中还原
- 更新 `useSpeechRecognition` 调用为三参数版本

### 3. `ControlPanel.vue` — 防重复提交

- 新增 `isSubmitting` ref
- `submitText` 入口检查，防止快速双击
- 300ms 后自动解锁

## 修改文件清单

| 文件 | 操作 |
|------|------|
| `src/composables/useSpeechRecognition.js` | 重构 API：`(onResult, onError)` → `(onDisplay, onFinal, onError)` |
| `src/App.vue` | 新增 `isProcessing` 锁 + 适配新回调签名 |
| `src/components/ControlPanel.vue` | 新增 `isSubmitting` 防重复提交 |
