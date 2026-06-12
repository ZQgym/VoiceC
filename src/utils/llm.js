// ============================================================
// LLM 集成模块 - 负责将自然语言转化为结构化绘图指令
// ============================================================
// 默认使用 OpenAI GPT-4o-mini API
// 也可配置为 DeepSeek / Claude 等其他兼容 API
// 支持 VITE_LLM_API_KEY / VITE_LLM_API_URL / VITE_LLM_MODEL 环境变量
// ============================================================

// 从环境变量或 localStorage 加载配置
function loadConfig() {
  const stored = localStorage.getItem('llm_config')
  const parsed = stored ? JSON.parse(stored) : {}

  return {
    apiUrl: parsed.apiUrl || import.meta.env.VITE_LLM_API_URL || 'https://api.openai.com/v1/chat/completions',
    apiKey: parsed.apiKey || import.meta.env.VITE_LLM_API_KEY || '',
    model: parsed.model || import.meta.env.VITE_LLM_MODEL || 'gpt-4o-mini',
    maxTokens: parsed.maxTokens || 3000,
    temperature: parsed.temperature || 0.3
  }
}

// 持久化到 localStorage
function saveConfig(config) {
  localStorage.setItem('llm_config', JSON.stringify(config))
}

const LLM_CONFIG = loadConfig()

// 允许运行时修改配置 (并持久化)
export function setLLMConfig(config) {
  Object.assign(LLM_CONFIG, config)
  saveConfig({ apiUrl: LLM_CONFIG.apiUrl, apiKey: LLM_CONFIG.apiKey, model: LLM_CONFIG.model, maxTokens: LLM_CONFIG.maxTokens, temperature: LLM_CONFIG.temperature })
}

export function getLLMConfig() {
  return { ...LLM_CONFIG }
}

/**
 * 构建 System Prompt
 * 包含：角色设定、JSON Schema 规范、上下文注入、构图规则约束
 */
function buildSystemPrompt(canvasState) {
  const canvasWidth = 800
  const canvasHeight = 600

  // 将画布状态序列化为可读文本注入 Prompt
  const stateText = canvasState && canvasState.length > 0
    ? canvasState.map((obj, i) =>
        `${i + 1}. id="${obj.id}", 类型=${obj.type}, ` +
        `位置=(${obj.left}, ${obj.top}), ` +
        `大小=${obj.width || 'N/A'}x${obj.height || 'N/A'}, ` +
        `半径=${obj.radius || 'N/A'}, ` +
        `填充色=${obj.fill}, 描边色=${obj.stroke}, ` +
        `文字="${obj.text || ''}", 角度=${obj.angle}°`
      ).join('\n')
    : '（画布当前为空，没有任何图形）'

  return `你是一个专业的绘图指令解析器。你的任务是将用户的自然语言绘图指令，转换为结构化 JSON 指令。

## 画布信息
- 画布尺寸：${canvasWidth} x ${canvasHeight} 像素
- 坐标系：原点在左上角，x 轴向右，y 轴向下
- 画布中心点坐标：(${canvasWidth / 2}, ${canvasHeight / 2})
- 有效坐标范围：x: 10~790, y: 10~590（留边距避免裁切）

## 当前画布上的图形
${stateText}

## 输出规范
你必须严格输出以下格式的 JSON，不要输出任何额外文字、解释或代码块标记。只输出纯 JSON 对象：

### 1. 绘制指令 (draw)
{
  "action": "draw",
  "shape": "circle|rect|triangle|line|text",
  "id": "<语义化ID，如 house_wall, snowman_body, face_eye1>",
  "props": {
    "x": <绝对像素坐标数字，或"center">,
    "y": <绝对像素坐标数字，或"center">,
    "radius": <数字，仅circle需要>,
    "width": <数字，rect/triangle需要>,
    "height": <数字，rect/triangle需要>,
    "fill": "<颜色英文名或hex值>",
    "stroke": "<描边颜色>",
    "strokeWidth": <数字>,
    "text": "<文字内容，仅text需要>",
    "fontSize": <数字，仅text需要>,
    "opacity": <0-1之间的数字>,
    "relativeTo": "<父图形id，子部件用于相对定位>"
  }
}

### 2. 修改指令 (modify)
{ "action": "modify", "id": "<已存在图形的id>", "props": { "left": "+50或-30等相对值", "top": "...", "fill": "...", "fontSize": ..., "angle": ... } }

### 3. 删除指令 (delete)
{ "action": "delete", "id": "<已存在图形的id>" }

### 4. 批量指令 (batch) — 复杂绘图必须用此格式
{ "action": "batch", "commands": [<多个 draw/modify/delete 指令>] }

### 5. 澄清指令 (clarify)
{ "action": "clarify", "message": "<用中文向用户提问>" }

## 🔑🔑🔑 构图规则（批量指令必须严格遵守）🔑🔑🔑

### 规则A：组合物体的父子定位法（最核心！）
当一个物体由多个部分组成（如雪人=身体+头+眼+鼻，房子=墙+屋顶+门）：
1. **父部件**（主躯干）：用绝对坐标 x/y 定位到画布目标位置
2. **子部件**：设置 relativeTo 为父部件 ID，x/y 为相对于父部件中心点的偏移量(单位像素)

#### 正确示例 — 雪人：
父部件 body 在 (550, 400)，所有子部件 relativeTo="sm_body"：
{"action":"batch","commands":[
  {"action":"draw","shape":"circle","id":"sm_body","props":{"x":550,"y":400,"radius":70,"fill":"white","stroke":"#ccc","strokeWidth":2}},
  {"action":"draw","shape":"circle","id":"sm_head","props":{"x":0,"y":-85,"radius":45,"fill":"white","stroke":"#ccc","strokeWidth":2,"relativeTo":"sm_body"}},
  {"action":"draw","shape":"circle","id":"sm_eye1","props":{"x":-18,"y":-95,"radius":5,"fill":"black","relativeTo":"sm_body"}},
  {"action":"draw","shape":"circle","id":"sm_eye2","props":{"x":18,"y":-95,"radius":5,"fill":"black","relativeTo":"sm_body"}},
  {"action":"draw","shape":"triangle","id":"sm_nose","props":{"x":0,"y":-80,"width":12,"height":16,"fill":"orange","relativeTo":"sm_body"}}
]}

#### 正确示例 — 房子：
父部件 wall 在 (240, 360)，所有子部件 relativeTo="hs_wall"：
{"action":"batch","commands":[
  {"action":"draw","shape":"rect","id":"hs_wall","props":{"x":240,"y":360,"width":180,"height":140,"fill":"#f5deb3","stroke":"#8b7355","strokeWidth":2}},
  {"action":"draw","shape":"triangle","id":"hs_roof","props":{"x":0,"y":-80,"width":200,"height":90,"fill":"red","relativeTo":"hs_wall"}},
  {"action":"draw","shape":"rect","id":"hs_door","props":{"x":0,"y":50,"width":40,"height":70,"fill":"brown","relativeTo":"hs_wall"}}
]}

### 规则B：多物体场景布局（"在旁边"等）
当用户说"A在B旁边/A在B左边/A在B右边/两个物体一起"时：
- 将画布分为左右两区：左侧主件 x≈200~260，右侧主件 x≈540~600
- 两物体间距约 100~150px，视觉紧邻但不重叠
- 垂直基线对齐(y相近)，营造"站在一起"的感觉
- 整体居中，不偏向一边

### 规则C：防溢出约束（子部件不得脱离父体）
- 屋顶宽度 ≤ 墙面宽度 × 1.25（最多超出12%）
- 门完全在墙面内：|door.x|+door.width/2 ≤ wall.width/2 且 door.y+door.height ≤ wall.height
- 雪人头底部 ≈ 身体顶部（head_y + head_radius ≈ body_y - body_radius）
- 眼睛在脸部圆内：|eye_x|+eye_radius ≤ head_radius

### 规则D：推荐比例速查表
| 物体 | 主部件尺寸 |
|------|-----------|
| 房子墙面 | width 160~200, height 130~150 |
| 屋顶 | width=墙面宽×1.1~1.15, height 80~100 |
| 门 | width 35~50, height=墙面高×0.5 |
| 雪人身体 | radius 65~75 |
| 雪人头 | radius 38~48 (约为身体的60%) |
| 眼/鼻小件 | radius 4~8 |
| 笑脸脸 | radius 90~110 |

## 核心规则
1. 只输出 JSON，不要 markdown 代码块，不要解释文字
2. 指代不明且画布有多图形时返回 clarify
3. 复杂需求用 batch 拆解，每个部件必须有语义化 ID（如 house_wall, sm_eye1）
4. "大"→ radius≈150 或 size≈200；"小"→ radius≈30 或 size≈50
5. 默认大小：circle r=80, rect 120x80, triangle 100x100, text fs=30
6. 单个未指定位置的放画布中心("center")
7. 坐标必须是数字或 "center"，不用百分比
8. 颜色用标准 CSS 名（red/blue/green/yellow/black/white/orange/purple/pink/brown/gray）
9. ⚠️ 批量指令中：父部件绝对定位(x/y数字)，子部件 relativeTo+偏移坐标！这是构图质量的关键！
10. ⚠️ 多物体场景必须整体规划布局，确保间距合理、视觉协调`
}

/**
 * 从 LLM 响应中提取纯 JSON
 */
function extractJSON(text) {
  if (!text) return null

  try { return JSON.parse(text.trim()) } catch (e) {}

  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  try { return JSON.parse(cleaned) } catch (e) {}

  const firstBrace = cleaned.indexOf('{'), lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1)) } catch (e) {}
  }

  const firstBracket = cleaned.indexOf('['), lastBracket = cleaned.lastIndexOf(']')
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    try { return JSON.parse(cleaned.substring(firstBracket, lastBracket + 1)) } catch (e) {}
  }

  console.error('无法从 LLM 响应中提取 JSON:', text)
  return null
}

/**
 * 调用 LLM API 解析用户指令 (带重试)
 */
export async function parseCommand(userText, canvasState = []) {
  if (!LLM_CONFIG.apiKey) {
    console.warn('未配置 LLM API Key，使用本地规则引擎降级处理')
    return localFallbackParser(userText, canvasState)
  }

  const systemPrompt = buildSystemPrompt(canvasState)
  const maxRetries = 2
  let lastError = null

  const isOpenAI = LLM_CONFIG.model.startsWith('gpt-')
  const isDeepSeek = LLM_CONFIG.model.startsWith('deepseek-')
  const supportJsonFormat = isOpenAI || isDeepSeek

  const reqBody = {
    model: LLM_CONFIG.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText }
    ],
    max_tokens: LLM_CONFIG.maxTokens,
    temperature: LLM_CONFIG.temperature
  }
  if (supportJsonFormat) {
    reqBody.response_format = { type: 'json_object' }
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(LLM_CONFIG.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LLM_CONFIG.apiKey}`
        },
        body: JSON.stringify(reqBody)
      })

      if (!response.ok) {
        const errText = await response.text()
        if (response.status === 429 && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }
        throw new Error(`API 请求失败 (${response.status}): ${errText}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''
      const result = extractJSON(content)
      if (result) return result
      if (attempt < maxRetries) continue
    } catch (error) {
      lastError = error
      console.error(`LLM 调用失败 (尝试 ${attempt + 1}/${maxRetries + 1}):`, error)
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
      }
    }
  }

  console.warn('LLM 全部重试失败，降级使用本地规则引擎。最后错误:', lastError)
  return localFallbackParser(userText, canvasState)
}

/**
 * 本地规则引擎降级方案
 */
function localFallbackParser(userText, canvasState) {
  const text = userText.trim()

  // --- 复杂组合预设 ---
  if (/笑[脸面容]/.test(text)) {
    const baseId = 'face_' + Date.now()
    return {
      action: 'batch', commands: [
        { action: 'draw', shape: 'circle', id: baseId, props: { x: 'center', y: 'center', radius: 100, fill: 'yellow', stroke: 'orange', strokeWidth: 3 } },
        { action: 'draw', shape: 'circle', id: baseId + '_eye1', props: { x: -35, y: -30, radius: 12, fill: 'black', relativeTo: baseId } },
        { action: 'draw', shape: 'circle', id: baseId + '_eye2', props: { x: 35, y: -30, radius: 12, fill: 'black', relativeTo: baseId } },
        { action: 'draw', shape: 'line', id: baseId + '_mouth', props: { x: 0, y: 30, points: [-30, 0, 0, 20, 30, 0], stroke: 'black', strokeWidth: 3, relativeTo: baseId } }
      ]
    }
  }

  if (/雪人/.test(text)) {
    const baseId = 'sm_' + Date.now()
    return {
      action: 'batch', commands: [
        { action: 'draw', shape: 'circle', id: baseId + 'body', props: { x: 'center', y: 80, radius: 70, fill: 'white', stroke: '#ccc', strokeWidth: 2 } },
        { action: 'draw', shape: 'circle', id: baseId + 'head', props: { x: 0, y: -70, radius: 45, fill: 'white', stroke: '#ccc', strokeWidth: 2, relativeTo: baseId + 'body' } },
        { action: 'draw', shape: 'circle', id: baseId + 'eye1', props: { x: -15, y: -75, radius: 5, fill: 'black', relativeTo: baseId + 'body' } },
        { action: 'draw', shape: 'circle', id: baseId + 'eye2', props: { x: 15, y: -75, radius: 5, fill: 'black', relativeTo: baseId + 'body' } },
        { action: 'draw', shape: 'triangle', id: baseId + 'nose', props: { x: 0, y: -65, width: 10, height: 15, fill: 'orange', relativeTo: baseId + 'body' } }
      ]
    }
  }

  if (/房子|房屋|小[屋房]/.test(text)) {
    const baseId = 'hs_' + Date.now()
    return {
      action: 'batch', commands: [
        { action: 'draw', shape: 'rect', id: baseId + 'wall', props: { x: 'center', y: 80, width: 160, height: 120, fill: '#f5deb3' } },
        { action: 'draw', shape: 'triangle', id: baseId + 'roof', props: { x: 0, y: -50, width: 180, height: 90, fill: 'red', relativeTo: baseId + 'wall' } },
        { action: 'draw', shape: 'rect', id: baseId + 'door', props: { x: 0, y: 40, width: 36, height: 65, fill: 'brown', relativeTo: baseId + 'wall' } }
      ]
    }
  }

  // --- 场景组合预设 ---
  if (/雪人.*(?:旁边|附近|左边|右边).*?(?:房子|屋)/i.test(text) || /(?:房子|屋).*?(?:旁边|附近|左边|右边).*?雪人/i.test(text)) {
    const t = Date.now()
    return {
      action: 'batch', commands: [
        // 房子在左边
        { action: 'draw', shape: 'rect', id: 'hs_wall_' + t, props: { x: 240, y: 360, width: 180, height: 140, fill: '#f5deb3', stroke: '#8b7355', strokeWidth: 2 } },
        { action: 'draw', shape: 'triangle', id: 'hs_roof_' + t, props: { x: 0, y: -80, width: 200, height: 90, fill: 'red', relativeTo: 'hs_wall_' + t } },
        { action: 'draw', shape: 'rect', id: 'hs_door_' + t, props: { x: 0, y: 55, width: 38, height: 70, fill: 'brown', relativeTo: 'hs_wall_' + t } },
        // 雪人在右边
        { action: 'draw', shape: 'circle', id: 'sm_body_' + t, props: { x: 560, y: 420, radius: 70, fill: 'white', stroke: '#ccc', strokeWidth: 2 } },
        { action: 'draw', shape: 'circle', id: 'sm_head_' + t, props: { x: 0, y: -85, radius: 45, fill: 'white', stroke: '#ccc', strokeWidth: 2, relativeTo: 'sm_body_' + t } },
        { action: 'draw', shape: 'circle', id: 'sm_eye1_' + t, props: { x: -18, y: -95, radius: 5, fill: 'black', relativeTo: 'sm_body_' + t } },
        { action: 'draw', shape: 'circle', id: 'sm_eye2_' + t, props: { x: 18, y: -95, radius: 5, fill: 'black', relativeTo: 'sm_body_' + t } },
        { action: 'draw', shape: 'triangle', id: 'sm_nose_' + t, props: { x: 0, y: -80, width: 12, height: 16, fill: 'orange', relativeTo: 'sm_body_' + t } }
      ]
    }
  }

  // --- 绘制指令匹配 ---
  const circleMatch = text.match(/画.*(?:圆|圈|⚪)/)
  if (circleMatch) {
    const colorMatch = text.match(/(红|蓝|绿|黄|黑|白|橙|紫|粉|棕|灰|青)色?/)
    const sizeMatch = text.match(/(大|小|巨大|很小)/)
    const colorMap = { '红': 'red', '蓝': 'blue', '绿': 'green', '黄': 'yellow', '黑': 'black', '白': 'white', '橙': 'orange', '紫': 'purple', '粉': 'pink', '棕': 'brown', '灰': 'gray', '青': 'cyan' }
    const fill = colorMatch ? (colorMap[colorMatch[1]] || 'red') : 'red'
    const radius = sizeMatch ? (sizeMatch[1] === '大' || sizeMatch[1] === '巨大' ? 150 : 30) : 80
    return { action: 'draw', shape: 'circle', id: 'circle_' + Date.now(), props: { x: 'center', y: 'center', radius, fill } }
  }

  const rectMatch = text.match(/画.*(?:矩形|方块|长方形|正方形|📦)/)
  if (rectMatch) {
    const colorMatch = text.match(/(红|蓝|绿|黄|黑|白|橙|紫|粉|棕|灰|青)色?/)
    const colorMap = { '红': 'red', '蓝': 'blue', '绿': 'green', '黄': 'yellow', '黑': 'black', '白': 'white', '橙': 'orange', '紫': 'purple', '粉': 'pink', '棕': 'brown', '灰': 'gray', '青': 'cyan' }
    const fill = colorMatch ? (colorMap[colorMatch[1]] || 'blue') : 'blue'
    return { action: 'draw', shape: 'rect', id: 'rect_' + Date.now(), props: { x: 'center', y: 'center', width: 120, height: 80, fill } }
  }

  const triangleMatch = text.match(/画.*三角/)
  if (triangleMatch) {
    const colorMatch = text.match(/(红|蓝|绿|黄|黑|白|橙|紫|粉|棕|灰|青)色?/)
    const colorMap = { '红': 'red', '蓝': 'blue', '绿': 'green', '黄': 'yellow', '黑': 'black', '白': 'white', '橙': 'orange', '紫': 'purple', '粉': 'pink', '棕': 'brown', '灰': 'gray', '青': 'cyan' }
    const fill = colorMatch ? (colorMap[colorMatch[1]] || 'green') : 'green'
    return { action: 'draw', shape: 'triangle', id: 'triangle_' + Date.now(), props: { x: 'center', y: 'center', width: 100, height: 100, fill } }
  }

  const lineMatch = text.match(/画.*(?:线|直线|线段)/)
  if (lineMatch) {
    return { action: 'draw', shape: 'line', id: 'line_' + Date.now(), props: { x: 200, y: 250, points: [0, 0, 400, 0], stroke: 'red', strokeWidth: 3 } }
  }

  const textMatch = text.match(/(?:写|输入|添加).*?(?:文字|文本|字)[：:]*[""「」]?(.+?)[""「」]?$/)
  if (textMatch) {
    return { action: 'draw', shape: 'text', id: 'text_' + Date.now(), props: { x: 'center', y: 'center', text: textMatch[1].trim(), fontSize: 30, fill: '#333' } }
  }

  // --- 修改匹配 ---
  const changeColorMatch = text.match(/(?:把|将).*(?:变成|改成|改为)(红|蓝|绿|黄|黑|白|橙|紫|粉|棕|灰|青)色?/)
  if (changeColorMatch) {
    const colorMap = { '红': 'red', '蓝': 'blue', '绿': 'green', '黄': 'yellow', '黑': 'black', '白': 'white', '橙': 'orange', '紫': 'purple', '粉': 'pink', '棕': 'brown', '灰': 'gray', '青': 'cyan' }
    const fill = colorMap[changeColorMatch[1]]
    if (canvasState.length === 1) return { action: 'modify', id: canvasState[0].id, props: { fill } }
    else if (canvasState.length > 1) return { action: 'clarify', message: `画布上有 ${canvasState.length} 个图形，请问您想把哪个变成${changeColorMatch[1]}色？` }
    else return { action: 'clarify', message: '画布上没有任何图形，请先说"画一个XX"来创建图形。' }
  }

  const deleteMatch = text.match(/(?:删除|移除|去掉|删掉)/)
  if (deleteMatch) {
    if (canvasState.length === 1) return { action: 'delete', id: canvasState[0].id }
    else if (canvasState.length > 1) return { action: 'clarify', message: `画布上有 ${canvasState.length} 个图形，请问您要删除哪一个？可以说"删除第N个"或描述它。` }
    else return { action: 'clarify', message: '画布上没有任何图形可以删除。' }
  }

  return { action: 'clarify', message: '抱歉，我没有理解您的指令。请说"画一个红色圆圈"这样的指令，或说"清空画布"、"撤销"等。' }
}
