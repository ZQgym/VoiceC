# 🎨 AI 语音绘图工具

> 完全通过语音指令进行绘图创作，无需鼠标和键盘操作。

---

## 项目概览

| 项目 | 说明 |
|------|------|
| **前端框架** | Vue 3 + Vite |
| **绘图引擎** | Fabric.js |
| **语音识别 (ASR)** | 浏览器原生 Web Speech API |
| **语音合成 (TTS)** | 浏览器原生 SpeechSynthesis |
| **AI 大脑 (LLM)** | OpenAI / DeepSeek / 兼容 API |

---

## 快速开始

### 环境要求

- **Node.js** >= 18
- **浏览器**：**Chrome**（必须，Web Speech API 仅 Chrome 完整支持）
- **麦克风**：需要开启麦克风权限

### 1. 安装依赖

```bash
cd voicec
npm install
```

### 2. 配置 LLM API Key

在项目根目录创建或编辑 `.env` 文件：

```env
# 必填：LLM API Key
VITE_LLM_API_KEY=sk-your-api-key-here

# 可选：API 地址（默认 OpenAI）
VITE_LLM_API_URL=https://api.openai.com/v1/chat/completions

# 可选：模型选择（默认 gpt-4o-mini）
VITE_LLM_MODEL=gpt-4o-mini
```

> 💡 **不配置 API Key 也能使用**——项目内置了本地规则引擎，支持基础绘图指令（画圆/矩形/三角形/线/文字/笑脸/雪人/房子）。

**支持的 API 服务商：**

| 服务商 | API URL | 模型名 |
|--------|---------|--------|
| OpenAI | `https://api.openai.com/v1/chat/completions` | `gpt-4o-mini` / `gpt-4o` |
| DeepSeek | `https://api.deepseek.com/v1/chat/completions` | `deepseek-chat` |
| 任意兼容 OpenAI 格式的代理 | 自定义 | 自定义 |

### 3. 启动开发服务器

```bash
npm run dev
```

浏览器打开 `http://localhost:5173`

---

## 使用指南

### 基本操作流程

```
1. 打开页面 → 点击「开始聆听」按钮
2. 浏览器弹窗请求麦克风权限 → 点击「允许」
3. 对着麦克风说出绘图指令
4. AI 自动解析并执行绘图 / TTS 语音反问
```

### 语音指令示例

#### 绘图指令

| 你说的话 | 效果 |
|----------|------|
| "画一个红色的圆" | 在画布中心画红色圆 |
| "画一个蓝色矩形" | 画蓝色矩形 |
| "画一个黄色三角形" | 画黄色三角形 |
| "画一个笑脸" | 批量绘制笑脸 |
| "画一个雪人" | 批量绘制雪人 |
| "画一个房子" | 批量绘制房子 |
| "写一个你好" | 在画布上添加文字 |

#### 修改/操作指令

| 你说的话 | 效果 |
|----------|------|
| "清空画布" | 清除所有图形 |
| "撤销" | 撤销上一步操作 |
| "重做" | 恢复撤销的操作 |
| "把它变成蓝色" | 修改图形颜色（多图形时 AI 会追问） |
| "删除它" | 删除图形（多图形时 AI 会追问） |

#### 模糊指令处理

当你说"把它变红"而画布上有多个图形时：
- AI 不会乱猜，而是通过 **TTS 语音反问**："画布上有3个图形，请问您想把哪个变成红色？"
- 你只需再次说话回答即可

---

## UI 界面说明

```
┌──────────────────────────────────────────┐
│              Canvas 画布区域               │
│          （鼠标操作已禁用，仅语音）          │
│                                           │
│                 🤖 AI 状态               │
│              AI 提问高亮显示               │
│             语音识别文本回显               │
├──────────────────────────────────────────┤
│        🎤 开始聆听    📝 文字输入         │
│                                           │
│     画布元素列表（动态更新）               │
│                                           │
│      ⚙️ API 配置面板（折叠）              │
│       API Key / URL / Model 可运行时修改   │
└──────────────────────────────────────────┘
```

---

## API Key 运行时配置

在页面底部的折叠面板中，可随时修改：

- **API Key**（password 类型，安全隐藏）
- **API URL**（更换 API 端点）
- **Model**（GPT-4o-mini / GPT-4o / Claude）

配置会自动保存到 `localStorage`，刷新页面不丢失。

---

## 容错与降级机制

| 层级 | 机制 |
|------|------|
| **ASR** | 6 种 Web Speech API 错误中文提示 |
| **本地拦截** | 清空/撤销/重做 正则匹配，零延迟 |
| **LLM 重试** | 429 限流自动重试 3 次（指数退避） |
| **LLM 降级** | API 异常 → 自动切换本地规则引擎 |
| **JSON 提取** | 多层容错：直接解析 → 去 markdown → 查括号 → 查数组 |

---

## 项目结构

```
voicec/
├── index.html              # 入口 HTML
├── package.json            # 项目依赖
├── vite.config.js          # Vite 配置
├── .env                    # 环境变量（API Key 等）
├── agent.md                # 项目总纲文档
├── README.md               # 本文件
├── logs/                   # 开发日志
│   └── step5-tts.md
└── src/
    ├── main.js             # Vue 入口
    ├── App.vue             # 主组件（核心逻辑）
    ├── style.css           # 全局样式
    ├── components/
    │   ├── CanvasArea.vue  # 画布组件
    │   └── ControlPanel.vue# 控制面板组件
    ├── composables/
    │   └── useSpeechRecognition.js  # 语音识别 Hook
    └── utils/
        ├── llm.js          # LLM 集成与命令解析
        └── commandExecutor.js       # 指令执行引擎
```

---

## 构建部署

```bash
# 生产构建
npm run build

# 预览构建结果
npm run preview
```

构建产物在 `dist/` 目录，可部署到任意静态服务器。

---

## 常见问题

**Q: 麦克风没反应？**
A: 检查浏览器是否授权了麦克风权限，Chrome 需要 HTTPS 或 localhost 环境。

**Q: AI 不执行复杂指令？**
A: 检查 `.env` 中 API Key 是否正确配置，或查看浏览器 Console 错误日志。

**Q: 语音识别不准？**
A: 尝试说慢一点、清晰一点。Web Speech API 的识别准确率依赖系统语音引擎。

**Q: 可以不配 API Key 吗？**
A: 可以。内置本地规则引擎支持画圆/矩形/三角形/线/文字/笑脸/雪人/房子等基础指令。
