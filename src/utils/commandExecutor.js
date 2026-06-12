// ============================================================
// 指令执行引擎 - 解析 LLM 返回的 JSON 并调用 Fabric.js 渲染
// ============================================================

/**
 * 生成唯一 ID
 */
function generateId(prefix = 'shape') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

/**
 * 解析坐标值
 * 支持 "center"、"+50"、"-30" 等相对值、纯数字
 * @param {*} val - 坐标值
 * @param {number} canvasSize - 画布尺寸(宽或高)
 * @param {number} objectSize - 对象尺寸(用于居中计算)
 * @returns {number} 绝对坐标
 */
function resolveCoord(val, canvasSize, objectSize = 0) {
  if (val === undefined || val === null) return 0
  if (val === 'center' || val === 'middle') {
    return canvasSize / 2 - objectSize / 2
  }
  if (typeof val === 'string' && (val.startsWith('+') || val.startsWith('-'))) {
    return parseFloat(val)
  }
  return Number(val)
}

/**
 * 执行单条指令
 * @param {Object} command - 指令 JSON
 * @param {Object} canvasRef - CanvasArea 组件引用
 * @param {Function} speakFn - TTS 播报函数
 * @param {Function} setQuestionFn - 设置 UI 澄清文本
 * @returns {boolean} 执行是否成功
 */
async function executeSingleCommand(command, canvasRef, speakFn, setQuestionFn) {
  if (!command || !command.action) {
    console.warn('无效指令:', command)
    return false
  }

  switch (command.action) {
    case 'draw': {
      return executeDraw(command, canvasRef)
    }

    case 'modify': {
      if (!command.id) {
        console.warn('modify 指令缺少 id')
        return false
      }
      // 处理坐标转换：LLM 可能用 x/y 或 left/top
      const modifyProps = { ...command.props }
      if (modifyProps.x !== undefined) { modifyProps.left = modifyProps.x; delete modifyProps.x }
      if (modifyProps.y !== undefined) { modifyProps.top = modifyProps.y; delete modifyProps.y }
      return canvasRef.modifyObject(command.id, modifyProps)
    }

    case 'delete': {
      if (!command.id) {
        console.warn('delete 指令缺少 id')
        return false
      }
      return canvasRef.deleteObject(command.id)
    }

    case 'batch': {
      if (!Array.isArray(command.commands)) {
        console.warn('batch 指令缺少 commands 数组')
        return false
      }
      let allOk = true
      for (const subCmd of command.commands) {
        const ok = await executeSingleCommand(subCmd, canvasRef, speakFn, setQuestionFn)
        if (!ok) allOk = false
      }
      return allOk
    }

    case 'clarify': {
      const msg = command.message || '请进一步说明您的指令。'
      // 设置 UI 提问文本
      setQuestionFn?.(msg)
      // 调用 TTS 播报
      speakFn?.(msg)
      return true
    }

    default:
      console.warn('未知指令类型:', command.action)
      return false
  }
}

/**
 * 执行绘制指令
 * 处理 relativeTo 相对定位
 */
function executeDraw(command, canvasRef) {
  const c = canvasRef
  if (!c) return false

  const shape = command.shape
  const rawId = command.id || generateId(shape)
  const props = { ...command.props, id: rawId }

  // 解析位置 - x/y 转 left/top
  let left = resolveCoord(props.x !== undefined ? props.x : props.left, c.getCenter().x * 2, props.width || props.radius * 2 || 0)
  let top = resolveCoord(props.y !== undefined ? props.y : props.top, c.getCenter().y * 2, props.height || props.radius * 2 || 0)

  // 处理 relativeTo 相对定位（子部件相对于父部件中心的偏移）
  if (props.relativeTo) {
    const parentObj = c.findObjectById(props.relativeTo)
    if (parentObj) {
      const parentCenter = parentObj.getCenterPoint()
      // LLM 给出的 x/y 是相对于父部件中心的像素偏移量
      // 最终位置 = 父中心 + 偏移 - 子物体自身尺寸的一半(使子物体中心落在偏移目标点)
      const offsetX = typeof props.x === 'string' ? parseFloat(props.x) : (props.x || 0)
      const offsetY = typeof props.y === 'string' ? parseFloat(props.y) : (props.y || 0)
      // 根据形状计算子物体的半宽/半高，用于居中偏移
      let halfW = 0, halfH = 0
      if (shape === 'circle') { halfW = props.radius || 50; halfH = props.radius || 50 }
      else if (shape === 'rect' || shape === 'triangle') { halfW = (props.width || 100) / 2; halfH = (props.height || 80) / 2 }
      else if (shape === 'line') { halfW = 0; halfH = 0 }
      else { halfW = (props.width || 60) / 2; halfH = (props.height || 30) / 2 }
      left = parentCenter.x + offsetX - halfW
      top = parentCenter.y + offsetY - halfH
    } else {
      console.warn(`relativeTo 指定的父图形 "${props.relativeTo}" 不存在，使用绝对坐标`)
    }
  }

  const drawProps = { ...props, left, top }

  // 确保有默认颜色
  if (!drawProps.fill && shape !== 'line') {
    drawProps.fill = '#e94560'
  }
  if (shape === 'line' && !drawProps.stroke) {
    drawProps.stroke = drawProps.fill || '#e94560'
  }

  switch (shape) {
    case 'circle': {
      drawProps.radius = drawProps.radius || 50
      c.addCircle(drawProps)
      return true
    }
    case 'rect': {
      drawProps.width = drawProps.width || 100
      drawProps.height = drawProps.height || 80
      c.addRect(drawProps)
      return true
    }
    case 'triangle': {
      drawProps.width = drawProps.width || 100
      drawProps.height = drawProps.height || 100
      c.addTriangle(drawProps)
      return true
    }
    case 'line': {
      drawProps.strokeWidth = drawProps.strokeWidth || 2
      drawProps.points = drawProps.points || [0, 0, 200, 0]
      c.addLine(drawProps)
      return true
    }
    case 'text': {
      drawProps.text = drawProps.text || 'Text'
      drawProps.fontSize = drawProps.fontSize || 24
      // 居中调整
      drawProps.left = drawProps.left || (c.getCenter().x * 2) / 2
      drawProps.top = drawProps.top || (c.getCenter().y * 2) / 2
      c.addText(drawProps)
      return true
    }
    default: {
      console.warn('不支持的图形类型:', shape)
      return false
    }
  }
}

/**
 * 生成画布状态摘要
 * 供 LLM 上下文使用
 */
export function generateStateSummary(canvasRef) {
  if (!canvasRef) return []
  return canvasRef.getCanvasState()
}

/**
 * 执行指令（顶层入口）
 * @param {Object} result - LLM 返回的 JSON
 * @param {Object} canvasRef - CanvasArea 组件引用
 * @param {Function} speakFn - TTS 播报函数
 * @param {Function} setQuestionFn - 设置 UI 澄清文本
 * @returns {boolean} 是否执行成功
 */
export async function executeCommand(result, canvasRef, speakFn, setQuestionFn) {
  if (!result) return false

  // 单个指令直接执行
  if (result.action) {
    return await executeSingleCommand(result, canvasRef, speakFn, setQuestionFn)
  }

  // 数组批量执行
  if (Array.isArray(result)) {
    let allOk = true
    for (const cmd of result) {
      const ok = await executeSingleCommand(cmd, canvasRef, speakFn, setQuestionFn)
      if (!ok) allOk = false
    }
    return allOk
  }

  console.warn('无法识别的指令格式:', result)
  return false
}
