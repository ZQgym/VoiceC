# Step 5 日志 - 容错与语音反馈 (TTS)

**完成时间**: 2026-06-12 01:18
**状态**: ✅ 已完成

---

## 完成工作

### 1. 语音合成 (TTS)
- 文件: `src/App.vue` — `speakMessage()` 函数
- 基于 `window.speechSynthesis`
- 语言: `zh-CN`，语速 1.0，音调 1.0
- 播报前 `cancel()` 取消排队中的语音
- 触发时机: LLM 返回 `action: 'clarify'` 时

### 2. 意图澄清流程
```
用户说"把它变红" → 画布有3个对象
  → LLM 返回 { action: "clarify", message: "画布上有3个图形，请问您想把哪个变成红色？" }
  → commandExecutor 检测到 clarify action
  → 调用 speakMessage() 语音播报
  → UI 同步显示提问 (ai-question CSS 样式)
  → 用户再次说话回答 → 新一轮解析
```

### 3. 多层容错机制

| 层级 | 机制 | 说明 |
|------|------|------|
| **ASR 层** | Web Speech API 错误码映射 | not-allowed/no-speech/network 等 6 种错误中文提示 |
| **本地拦截** | 正则匹配简单指令 | 清空/撤销/重做 不走 LLM，零延迟 |
| **LLM 层** | 429 限流自动重试 (3次) | 指数退避 1s/2s |
| **LLM 层** | API 异常降级到本地引擎 | 网络错误/Key 过期 → localFallbackParser |
| **JSON 层** | 多层提取容错 | 直接解析 → 去 markdown → 查括号 → 查数组 |
| **执行层** | 对象查找失败警告 | findObjectById 返回 null 时的安全处理 |
| **UI 层** | API Key 动态配置 | 运行时修改 API Key/URL/Model 无需重启 |

### 4. API Key 配置 UI
- 折叠面板 `<details>` 放置在控制面板底部
- 支持配置: API Key (password 类型), API URL, 模型选择 (GPT-4o-mini/4o/Claude)
- 配置持久化到 localStorage (通过 setLLMConfig)
- 也支持 VITE_LLM_API_KEY 环境变量
- 留空 API Key → 自动使用本地规则引擎

### 5. UI 状态反馈
- `aiStatus` 实时显示: 待命中 → 正在聆听 → AI 思考中 → 执行完成/失败
- `aiQuestion` 特殊样式高亮显示 AI 提问
- `recognizedText` 显示语音识别中间/最终结果
- `canvasObjects` 列表动态更新画布元素

### 6. 操作反馈语音提示
成功执行绘图后，用户可听到:
- clarify → "画布上有3个图形，请问您想把哪个变成红色？"
- 未来可扩展: 成功语音反馈 ("已为您画好红色圆圈")

### 约束检查清单进度
- [x] 画布鼠标点击、拖拽已完全禁用 ✅
- [x] 语音识别模块完成 ✅
- [x] LLM System Prompt 设计完成 ✅
- [x] 意图澄清机制 (clarify action + TTS) ✅
- [x] 复杂指令拆解 (batch action) ✅
- [x] JSON 提取安全校验 ✅
- [x] relativeTo 相对定位 ✅
- [x] Fabric.js 渲染引擎 ✅
- [x] TTS 语音反馈 ✅
- [x] API Key 动态配置 ✅
- [x] 多层容错降级 ✅
