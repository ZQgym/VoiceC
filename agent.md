# AI 语音绘图工具 - 项目总纲

## 角色与目标
独立开发一款【AI 语音绘图工具】。用户绝对不能使用鼠标或键盘，仅通过语音指令完成所有绘图创作。

## 核心技术栈
- 前端框架：Vue 3 (Vite)
- 绘图引擎：Fabric.js
- 语音识别 (ASR)：浏览器原生 Web Speech API (SpeechRecognition)
- 语音合成 (TTS)：浏览器原生 Web Speech API (SpeechSynthesis)
- 大语言模型 (LLM)：通过 API 调用 GPT-4o-mini 或 Claude 3.5 Sonnet

## 核心系统架构："哑前端+智能大脑"
1. 【语音捕获】用户说话 -> Web Speech API 转为文本
2. 【意图拦截】前端正则匹配简单指令，直接执行
3. 【上下文组装】复杂指令 -> [用户文本 + 画布状态摘要] -> LLM
4. 【智能解析】LLM 返回结构化 JSON 指令
5. 【指令执行】前端解析 JSON -> Fabric.js API 渲染
6. 【语音反馈】LLM 澄清请求 -> TTS 播报

## 绘图指令 JSON Schema
```json
// draw: 绘制指令 (支持相对坐标)
{ "action": "draw", "shape": "circle|rect|triangle|line|text", "id": "auto_gen", "props": { ... } }
// modify: 修改指令
{ "action": "modify", "id": "shape_id", "props": { "fill": "blue", "left": "+50" } }
// delete: 删除指令
{ "action": "delete", "id": "shape_id" }
// batch: 复杂指令拆解
{ "action": "batch", "commands": [ ... ] }
// clarify: 澄清指令
{ "action": "clarify", "message": "..." }
```

## 约束条件检查清单
- [ ] 画布鼠标点击、拖拽已完全禁用
- [ ] 意图澄清机制应对模糊指令
- [ ] 复杂指令拆解 (如"画一个雪人")
- [ ] LLM 输出被严格约束为安全 JSON

## 开发步骤
1. Step 1: 项目初始化与基础 UI
2. Step 2: 语音识别 (ASR) 模块
3. Step 3: LLM 集成与 Prompt 工程
4. Step 4: 指令执行引擎 (Fabric.js 渲染)
5. Step 5: 容错与语音反馈 (TTS)
6. Step 6: 设计文档生成
