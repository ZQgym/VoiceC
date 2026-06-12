# Step 10 日志 - 修改文件变更记录

**时间**: 2026-06-12 10:54
**状态**: 📋 变更汇总

---

## 本次修改文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `.env` | 新建 | DeepSeek API 配置（Key + URL + Model） |
| `README.md` | 新建 | 项目启动/使用文档 |
| `logs/commands-manual.md` | 新建 | 复杂绘图指令手册（10大类） |
| `logs/step8-config.md` | 新建 | API 配置与项目部署验证日志 |
| `logs/step9-fix.md` | 新建 | 空白页面 Bug 修复日志 |
| `logs/step10-changes.md` | 新建 | 本文档 - 文件变更记录 |
| `src/utils/llm.js` | 修改 | 优化 System Prompt（新增构图规则A~D + 比例速查表）; 修复模板字符串反引号嵌套问题 |
| `src/utils/commandExecutor.js` | 修改 | 修复 relativeTo 相对定位算法（按形状分别计算半宽/半高） |

---

## 修改详情

### 1. `src/utils/llm.js`
- System Prompt 新增 **4 条构图规则**：
  - 规则A：父子定位法（父部件绝对坐标 + 子部件 relativeTo 偏移）
  - 规则B：多物体场景布局（左右分区、间距、对齐）
  - 规则C：防溢出约束（子部件不脱离父体）
  - 规则D：推荐比例速查表
- 内嵌雪人/房子的完整 JSON 示例
- `maxTokens` 从 2000 提升到 3000
- 移除示例代码的反引号包裹（修复模板字符串解析错误）

### 2. `src/utils/commandExecutor.js`
- `relativeTo` 定位逻辑改为按图形类型分别计算半宽/半高：
  - circle → `halfW = halfH = radius`
  - rect/triangle → `halfW = width/2, halfH = height/2`
  - line → `halfW = halfH = 0`
  - 其他 → `halfW = width/2, halfH = height/2`

### 3. `.env`
```env
VITE_LLM_API_KEY=sk-20da247d3d30479a9dddb7e4ab69165e
VITE_LLM_API_URL=https://api.deepseek.com/chat/completions
VITE_LLM_MODEL=deepseek-v4-flash
```

---

## 未修改文件

| 文件 | 说明 |
|------|------|
| `src/App.vue` | 主组件，未改动 |
| `src/main.js` | 入口，未改动 |
| `src/style.css` | 样式，未改动 |
| `src/components/*` | Vue 子组件，未改动 |
| `src/composables/useSpeechRecognition.js` | 语音识别，未改动 |
| `index.html` | 入口 HTML，未改动 |
| `vite.config.js` | 构建配置，未改动 |
| `package.json` | 依赖配置，未改动 |
