# AI 语音绘图工具 — 设计文档

> 版本: 1.0.0 | 日期: 2026-06-12 | 架构: Vue 3 + Fabric.js + Web Speech API + LLM

---

## 目录

1. [系统概述](#1-系统概述)
2. [核心架构](#2-核心架构)
3. [计划支持与最终实现的指令能力对比](#3-指令能力对比)
4. [文件结构](#4-文件结构)
5. [数据流详解](#5-数据流详解)
6. [JSON Schema 最终规范](#6-json-schema-最终规范)
7. [延迟优化策略](#7-延迟优化策略)
8. [未完成部分说明](#8-未完成部分说明)
9. [约束条件检查清单](#9-约束条件检查清单)
10. [部署指南](#10-部署指南)

---

## 1. 系统概述

AI 语音绘图工具是一款纯语音驱动的在线绘图应用。用户通过麦克风说话，系统自动将语音转为文本，经 LLM 解析为结构化绘图指令，最终调用 Fabric.js 在 Canvas 上渲染图形。

**核心原则**：用户绝对不能使用鼠标或键盘，仅通过语音指令完成所有创作。

---

## 2. 核心架构

### "哑前端 + 智能大脑" 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        浏览器前端 (Vue 3)                        │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │ 语音捕获      │   │ 意图拦截      │   │ Fabric.js 画布       │ │
│  │ Web Speech    │──▶│ 正则匹配      │──▶│ - 鼠标交互已禁用    │ │
│  │ API (ASR)     │   │ 清空/撤销/重做│   │ - 纯语音控制        │ │
│  └──────────────┘   └──────┬───────┘   └──────────────────────┘ │
│                             │ 复杂指令                           │
│                             ▼                                    │
│                    ┌──────────────────┐                          │
│                    │ 上下文组装        │                          │
│                    │ 用户文本 + 画布状态│                          │
│                    └────────┬─────────┘                          │
│                             │                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LLM (GPT-4o-mini)                             │
│              System Prompt + 画布状态 + 用户指令                  │
│                         ↓                                        │
│                   结构化 JSON 指令                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      指令执行引擎                                 │
│         draw / modify / delete / batch / clarify                 │
│                         ↓                                        │
│              Fabric.js API → Canvas 渲染                         │
│                         ↓                                        │
│           TTS 语音反馈 (仅 clarify 时播报)                        │
└─────────────────────────────────────────────────────────────────┘
```

### 降级路径

```
LLM API 可用? ──YES──▶ GPT-4o-mini 解析 ──▶ JSON 执行
    │
    NO (或 API 失败)
    │
    ▼
本地规则引擎 (localFallbackParser)
    │
    ▼
正则匹配 → 结构化 JSON → 执行
    │
    无法匹配
    │
    ▼
 clarify 指令 → TTS 播报引导
```

---

## 3. 指令能力对比

### 计划支持 vs 最终实现

| 能力类别 | 指令示例 | 计划支持 | 实现状态 | 说明 |
|----------|---------|:--------:|:--------:|------|
| **基础绘图** | "画一个红色圆圈" | ✅ | ✅ 实现 | 支持 circle/rect/triangle/line/text |
| **颜色指定** | "画一个蓝色的方块" | ✅ | ✅ 实现 | LLM + 本地引擎均支持中英文颜色映射 |
| **大小描述** | "画一个大圆" / "画一个小三角" | ✅ | ✅ 实现 | 大=150px, 小=30px, 本地引擎支持 |
| **属性修改** | "把它变成蓝色" | ✅ | ✅ 实现 | modify action，支持颜色/大小/位置/透明度等 |
| **相对定位** | relativeTo + 相对偏移 | ✅ | ✅ 实现 | 笑脸/雪人等组合图形基于父图形定位 |
| **组合图形** | "画一个笑脸" / "画一个雪人" | ✅ | ✅ 实现 | batch action 拆解为多个子指令 |
| **画房子** | "画一个房子" | ✅ | ✅ 实现 | 本地引擎预设: 墙壁+屋顶+门 |
| **意图澄清** | "把它变红" (画布有多个图形) | ✅ | ✅ 实现 | clarify action + TTS 播报 + UI 显示 |
| **删除操作** | "删除它" / "删除那个圆" | ✅ | ✅ 实现 | delete action，多对象时触发 clarify |
| **清空画布** | "清空画布" / "全部删除" | ✅ | ✅ 实现 | 正则拦截，零延迟本地执行 |
| **撤销/重做** | "撤销" / "重做" | ✅ | ✅ 实现 | 正则拦截，历史栈最多 50 步 |
| **文字绘制** | "写Hello World" | ✅ | ✅ 实现 | text shape，LLM 或本地引擎支持 |
| **画线** | "画一条线" / "画一条红线" | ✅ | ✅ 实现 | line shape，本地引擎支持 |
| **多图形删除** | "删除所有" | ✅ | ✅ 实现 | 通过 "清空画布" 正则拦截 |
| **移动图形** | "把圆往右移50像素" | ⚠️ 部分 | ⚠️ 部分 | modify + 相对 left/top 支持，但自然语言理解需 LLM |
| **旋转图形** | "把方块旋转45度" | ⚠️ 部分 | ⚠️ 部分 | modify 支持 angle 属性，需 LLM 解析 |
| **图层管理** | "把圆放到最上面" | ❌ 未实现 | ❌ 未实现 | Fabric.js 支持但未在此版本实现 |
| **缩放图形** | "把圆放大两倍" | ❌ 未实现 | ❌ 未实现 | 需 LLM 解析相对缩放语义 |
| **自由绘制** | "画一个曲线" | ❌ 未实现 | ❌ 未实现 | Fabric.js Path 支持但 LLM 难以参数化 |
| **导入/导出** | "保存画布" / "打开文件" | ❌ 未实现 | ❌ 未实现 | 后续版本计划 |
| **画布背景** | "把背景变成蓝色" | ❌ 未实现 | ❌ 未实现 | 后续版本计划 |

### 实现覆盖率
- **完全实现**: 14 项
- **部分实现**: 2 项 (移动/旋转需 LLM 精确解析)
- **未实现**: 5 项 (图层/缩放/自由绘制/导入导出/背景)

---

## 4. 文件结构

```
voicec/
├── agent.md                           # 项目总纲
├── logs/                              # 开发日志
│   ├── step1-init.md                  # Step 1 日志
│   ├── step2-asr.md                   # Step 2 日志
│   ├── step3-llm.md                   # Step 3 日志
│   ├── step4-executor.md              # Step 4 日志
│   ├── step5-tts.md                   # Step 5 日志
│   └── design-doc.md                  # 本文档
├── src/
│   ├── main.js                        # Vue 入口
│   ├── App.vue                        # 根组件 (核心状态 + 数据流)
│   ├── style.css                      # 全局样式
│   ├── components/
│   │   ├── CanvasArea.vue             # Fabric.js 画布 (鼠标已禁用)
│   │   └── ControlPanel.vue           # 控制面板 (麦克风+状态+配置)
│   ├── composables/
│   │   └── useSpeechRecognition.js    # ASR Hook
│   └── utils/
│       ├── llm.js                     # LLM 集成 + 本地规则引擎
│       └── commandExecutor.js         # 指令执行引擎
├── index.html
├── package.json
└── vite.config.js
```

---

## 5. 数据流详解

### 完整调用链路

```
1. 用户点击麦克风按钮
     ↓
2. useSpeechRecognition.start()
   Web Speech API 开始录音 (zh-CN, interimResults)
     ↓
3. onresult → 实时显示中间文本
   onend   → 获取最终文本
     ↓
4. App.vue handleUserInput(text)
   ↓
   ├─ [正则拦截] "清空画布" → canvasRef.clearCanvas() → 结束
   ├─ [正则拦截] "撤销"     → canvasRef.undoAction()   → 结束
   ├─ [正则拦截] "重做"     → canvasRef.redoAction()    → 结束
   │
   └─ [复杂指令] → parseCommand(text, canvasState)
        ↓
        ├─ [有 API Key] → fetch GPT-4o-mini → extractJSON()
        ├─ [API 失败]   → 重试 3 次 (429 退避)
        └─ [无 API Key] → localFallbackParser(text, canvasState)
             ↓
5. executeCommand(result, canvasRef, speakMessage, setQuestion)
   ↓
   ├─ draw    → CanvasArea.addCircle/rect/triangle/line/text
   ├─ modify  → CanvasArea.modifyObject(id, props)
   ├─ delete  → CanvasArea.deleteObject(id)
   ├─ batch   → 递归执行 commands[]
   └─ clarify → speakMessage() + UI 显示提问
        ↓
6. refreshObjectList() → 更新 UI 画布元素列表
```

---

## 6. JSON Schema 最终规范

```json
// 1. 绘制
{ "action": "draw", "shape": "circle", "id": "circle_123",
  "props": { "x": "center", "y": "center", "radius": 80, "fill": "red" } }

// 2. 修改 (支持相对值)
{ "action": "modify", "id": "circle_123",
  "props": { "fill": "blue", "left": "+50", "top": "-30" } }

// 3. 删除
{ "action": "delete", "id": "circle_123" }

// 4. 批量 (复杂图形)
{ "action": "batch", "commands": [
  { "action": "draw", "shape": "circle", "id": "face", "props": {...} },
  { "action": "draw", "shape": "circle", "id": "eye1", "props": { "x": -30, "y": -30, "relativeTo": "face", ...} }
]}

// 5. 澄清
{ "action": "clarify", "message": "画布上有3个图形，请问您想把哪个变成红色？" }
```

### 支持的 Props 属性

| 属性 | 类型 | 适用图形 | 说明 |
|------|------|----------|------|
| x, y | number\|"center"\|"+50" | 全部 | 位置，center=画布中心 |
| radius | number | circle | 半径 |
| width, height | number | rect, triangle | 宽高 |
| fill | string | 全部 (除 line) | 填充色 (CSS 颜色名) |
| stroke | string | line, 全部 | 描边色 |
| strokeWidth | number | line, 全部 | 描边宽度 |
| text | string | text | 文字内容 |
| fontSize | number | text | 字号 |
| fontFamily | string | text | 字体 |
| fontWeight | string | text | 字重 |
| opacity | 0-1 | 全部 | 透明度 |
| angle | number | 全部 | 旋转角度 |
| points | [x1,y1,x2,y2] | line | 端点坐标 |
| relativeTo | string (id) | 全部 | 父图形 ID |
| rx, ry | number | rect | 圆角半径 |

---

## 7. 延迟优化策略

### 7.1 正则拦截 (零网络延迟)
简单指令在本地用正则匹配，完全不经过 LLM：
```javascript
const simpleCommands = {
  clear: /^(清空|清除|全部删除|清屏|删掉所有|删除全部)/,
  undo:  /^(撤销|回退|返回上一步|取消)/,
  redo:  /^(重做|恢复)/
}
```
**效果**: 清空/撤销/重做 < 10ms 响应

### 7.2 本地规则引擎
无 API Key 时 `localFallbackParser()` 用 O(1) 正则匹配提供基础绘图能力：
- 6 种绘制指令 (圆/矩/三角/线/文字/颜色)
- 3 种组合预设 (笑脸/雪人/房子)
- 修改/删除/clarify 逻辑
**效果**: 零网络依赖，即时响应

### 7.3 LLM 调用优化
- `response_format: { type: 'json_object' }` — 强制 JSON 输出 (减少 markdown 冗余)
- `temperature: 0.3` — 低温度减少随机性，提升一致性
- `maxTokens: 2000` — 限制输出长度
- 429 限流指数退避重试 (1s → 2s)
- API 失败自动降级

### 7.4 前端渲染优化
- 按需 `canvas.renderAll()` — 仅在操作完成后渲染
- `suppressHistory` 标志 — 批量操作时避免重复序列化
- 历史栈上限 50 步 — 避免内存溢出

### 7.5 ASR 优化
- `interimResults: true` — 实时显示中间结果给用户即时反馈
- `continuous: false` — 单次识别避免长时间占用
- `maxAlternatives: 1` — 减少返回数据量

---

## 8. 未完成部分说明

### 8.1 图层管理 (z-index)
- **原因**: Fabric.js 提供了 `canvas.sendToBack()` / `bringToFront()` 等方法，但自然语言"把圆放到最上面"的语义解析需要 LLM 额外训练上下文，当前 System Prompt 未包含图层排序规则。优先级较低，可在后续版本添加 `moveTo` action。

### 8.2 缩放图形
- **原因**: "把圆放大两倍" 需要 LLM 计算 `radius * 2` 或 `scaleX * 2`。当前 modify 已支持直接设置尺寸，但缺少"倍数"语义映射。建议让 LLM 自行计算并返回修改后的数值。

### 8.3 自由绘制 (曲线/路径)
- **原因**: Fabric.js 支持 `Path` 对象，但自由曲线无法通过自然语言精确参数化（如贝塞尔控制点）。适用场景非常有限，V1 版本不做支持。

### 8.4 导入/导出
- **原因**: 可通过 `canvas.toJSON()` / `loadFromJSON()` 实现，属于功能增强，非核心语音交互需求。

### 8.5 Web Speech API 识别率
- **原因**: 浏览器内置 ASR 在嘈杂环境下识别率下降，可能导致：
  - 误识别 ("画一个圆" → "换一个圆")
  - 漏识别 (未检测到语音)
  - 中文多音字歧义
- **缓解**: 当前通过 LLM clarify 机制处理歧义，提示用户重新表述。未来可考虑集成更高精度的 ASR 服务（如讯飞/百度语音 API）。

---

## 9. 约束条件检查清单

| 检查项 | 状态 | 实现方式 |
|--------|:----:|----------|
| 画布鼠标点击、拖拽已完全禁用 | ✅ | `canvas.selection=false`, 所有对象 `selectable/evented=false`, 重写 `_onMouseDown` |
| 意图澄清机制应对模糊指令 | ✅ | LLM clarify action + TTS 播报 + UI 高亮显示 |
| 复杂指令拆解 (如"画一个雪人") | ✅ | batch action 递归执行子指令 + 本地预设 (笑脸/雪人/房子) |
| LLM 输出被严格约束为安全 JSON | ✅ | System Prompt 强调 + `response_format: json_object` + 多层 JSON 提取容错 |

---

## 10. 部署指南

### 10.1 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
# → http://localhost:5173

# 配置 LLM API Key (三种方式任选其一)
# 方式1: 环境变量
#   创建 .env 文件: VITE_LLM_API_KEY=sk-xxx
# 方式2: UI 配置面板
#   启动后在右下角 ⚙️ LLM 配置 中输入 API Key
# 方式3: 浏览器控制台
#   setLLMConfig({ apiKey: 'sk-xxx' })
```

### 10.2 生产构建

```bash
npm run build
# 输出到 dist/ 目录，部署到任意静态服务器
```

### 10.3 浏览器兼容性

| 功能 | Chrome | Edge | Firefox | Safari |
|------|:------:|:----:|:-------:|:------:|
| Web Speech API (ASR) | ✅ 49+ | ✅ 79+ | ❌ | ⚠️ 14.1+ |
| SpeechSynthesis (TTS) | ✅ 33+ | ✅ 79+ | ✅ 49+ | ✅ 7+ |
| Fabric.js | ✅ | ✅ | ✅ | ✅ |
| Vue 3 | ✅ | ✅ | ✅ | ✅ |

> **推荐**: Chrome 或 Edge 以获得完整语音识别体验

### 10.4 无需 API Key 模式

未配置 LLM API Key 时，系统自动降级到本地规则引擎：
- ✅ 基础绘图 (圆/方/三角/线/文字)
- ✅ 颜色修改 (单对象自动匹配)
- ✅ 清空/撤销/重做
- ✅ 组合图形 (笑脸/雪人/房子)
- ❌ 复杂自然语言理解
- ❌ 模糊指代智能消歧
