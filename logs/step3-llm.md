# Step 3 日志 - LLM 集成与 Prompt 工程

**完成时间**: 2026-06-12 01:12
**状态**: ✅ 已完成

---

## 完成工作

### 1. parseCommand 异步函数
- 文件: `src/utils/llm.js`
- 负责与 LLM API (OpenAI GPT-4o-mini) 交互
- 带重试机制 (最多 3 次，429 限流自动退避)
- 使用 `response_format: { type: 'json_object' }` 强制 JSON 输出
- API 调用失败后自动降级到本地规则引擎

### 2. System Prompt 设计 (核心)
构建在 `buildSystemPrompt()` 函数中，包含五大要素：

| 要素 | 内容 |
|------|------|
| **角色设定** | "你是一个专业的绘图指令解析器" |
| **画布上下文** | 尺寸 800x600，坐标原点左上角，中心 (400,300) |
| **状态注入** | 当前画布所有图形：id、类型、位置、大小、颜色、文字、角度 |
| **Schema 规范** | draw/modify/delete/batch/clarify 五种动作，完整 props 定义 |
| **规则约束** | 只输出纯 JSON、模糊指代 → clarify、复杂需求 → batch、大小语义映射、默认尺寸、center 定位、CSS 颜色名 |

### 3. JSON 提取与安全校验
- `extractJSON()` 多层容错：
  1. 直接 JSON.parse
  2. 移除 markdown 代码块标记后解析
  3. 查找 `{...}` 边界提取
  4. 查找 `[...]` 边界提取
- 全部失败返回 null，触发本地降级

### 4. 本地规则引擎降级方案 (localFallbackParser)
无需 LLM API Key 即可使用的基础指令解析：
- **绘图**: 圆、矩形、三角形、线、文字 (正则 + 颜色中文映射)
- **复杂预设**: 笑脸 (4 子指令)、雪人 (5 子指令)、房子 (3 子指令)
- **修改**: 颜色变更、大小调整，画布单对象直接执行，多对象 → clarify
- **删除**: 单对象直接删除，多对象 → clarify
- **未知**: 返回 clarify 引导

### 5. 配置管理
- 支持 `VITE_LLM_API_KEY` / `VITE_LLM_API_URL` / `VITE_LLM_MODEL` 环境变量
- localStorage 持久化用户配置
- `setLLMConfig()` 运行时动态修改

### 6. 延迟优化
- 429 限流退避策略 (1s/2s 递增等待)
- API 超时自动降级到本地引擎
- 本地引擎 O(1) 正则匹配，零网络延迟

### 约束检查清单进度
- [x] 画布鼠标点击、拖拽已完全禁用 ✅
- [x] 语音识别模块完成 ✅
- [x] LLM System Prompt 设计完成 ✅
- [x] 意图澄清机制 (clarify action) ✅
- [x] 复杂指令拆解 (batch action) ✅
- [x] JSON 提取安全校验 ✅
