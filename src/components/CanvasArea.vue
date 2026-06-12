<template>
  <div class="canvas-area">
    <canvas ref="canvasEl"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { fabric } from 'fabric'

const canvasEl = ref(null)
let canvas = null

// 用于撤销/重做
const history = []
let historyIndex = -1
const maxHistory = 50
let suppressHistory = false

onMounted(() => {
  initCanvas()
  window.addEventListener('resize', resizeCanvas)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCanvas)
  canvas?.dispose()
})

function initCanvas() {
  const el = canvasEl.value
  if (!el) return

  canvas = new fabric.Canvas(el, {
    width: el.parentElement.clientWidth,
    height: el.parentElement.clientHeight,
    backgroundColor: '#ffffff',
    // 【核心约束】完全禁用鼠标交互
    selection: false,
    hoverCursor: 'default',
    moveCursor: 'default',
    defaultCursor: 'default',
    allowTouchScrolling: false
  })

  // 禁止所有对象选中与拖拽
  canvas.on('object:added', (e) => {
    if (e.target) {
      e.target.selectable = false
      e.target.evented = false
      e.target.hoverCursor = 'default'
      e.target.moveCursor = 'default'
    }
    if (!suppressHistory) {
      saveHistory()
    }
  })

  canvas.on('object:modified', () => {
    if (!suppressHistory) {
      saveHistory()
    }
  })

  // 全局禁用鼠标事件
  canvas.on('mouse:down', (e) => {
    e.e.preventDefault()
    e.e.stopPropagation()
  })

  // 重写 _onMouseDown 彻底禁用交互
  const origOnMouseDown = canvas._onMouseDown.bind(canvas)
  canvas._onMouseDown = () => {}

  resizeCanvas()
}

function resizeCanvas() {
  if (!canvas || !canvasEl.value) return
  const parent = canvasEl.value.parentElement
  canvas.setWidth(parent.clientWidth)
  canvas.setHeight(parent.clientHeight)
  canvas.renderAll()
}

// ---- 历史记录 (撤销/重做) ----
function saveHistory() {
  if (suppressHistory) return
  // 删除超过当前 index 的未来状态
  if (historyIndex < history.length - 1) {
    history.splice(historyIndex + 1)
  }
  history.push(JSON.stringify(canvas.toJSON()))
  historyIndex = history.length - 1
  // 限制历史长度
  if (history.length > maxHistory) {
    history.shift()
    historyIndex--
  }
}

function undoAction() {
  if (historyIndex <= 0) return
  historyIndex--
  loadHistoryState(history[historyIndex])
}

function redoAction() {
  if (historyIndex >= history.length - 1) return
  historyIndex++
  loadHistoryState(history[historyIndex])
}

function loadHistoryState(json) {
  suppressHistory = true
  canvas.loadFromJSON(JSON.parse(json), () => {
    canvas.renderAll()
    // 重新禁用所有对象的交互
    canvas.getObjects().forEach(obj => {
      obj.selectable = false
      obj.evented = false
    })
    suppressHistory = false
  })
}

// ---- 暴露给父组件的方法 ----
function clearCanvas() {
  suppressHistory = true
  canvas.clear()
  canvas.backgroundColor = '#ffffff'
  canvas.renderAll()
  suppressHistory = false
  saveHistory()
}

function getCanvasState() {
  return canvas.getObjects().map(obj => ({
    id: obj._id || obj.id || '',
    type: getShapeType(obj),
    left: Math.round(obj.left || 0),
    top: Math.round(obj.top || 0),
    width: Math.round((obj.width || 0) * (obj.scaleX || 1)),
    height: Math.round((obj.height || 0) * (obj.scaleY || 1)),
    radius: obj.radius ? Math.round(obj.radius) : undefined,
    fill: obj.fill || 'transparent',
    stroke: obj.stroke || 'none',
    text: obj.text || undefined,
    fontSize: obj.fontSize || undefined,
    angle: obj.angle || 0,
    opacity: obj.opacity || 1
  }))
}

function getObjectList() {
  return canvas.getObjects().map(obj => ({
    id: obj._id || obj.id || '',
    type: getShapeType(obj),
    fill: obj.fill || 'transparent',
    text: obj.text || ''
  }))
}

function getShapeType(obj) {
  if (obj.type === 'circle' || obj.type === 'ellipse') return 'circle'
  if (obj.type === 'rect') return 'rect'
  if (obj.type === 'triangle') return 'triangle'
  if (obj.type === 'line') return 'line'
  if (obj.type === 'text' || obj.type === 'i-text' || obj.type === 'textbox') return 'text'
  if (obj.type === 'group') return 'group'
  return obj.type || 'unknown'
}

// ---- 绘制方法 ----
function addCircle(props) {
  const obj = new fabric.Circle({
    radius: props.radius || 50,
    fill: props.fill || '#e94560',
    stroke: props.stroke || null,
    strokeWidth: props.strokeWidth || 0,
    left: props.left !== undefined ? props.left : 100,
    top: props.top !== undefined ? props.top : 100,
    opacity: props.opacity !== undefined ? props.opacity : 1,
    selectable: false,
    evented: false,
    hoverCursor: 'default'
  })
  obj._id = props.id || ('circle_' + Date.now())
  canvas.add(obj)
  return obj
}

function addRect(props) {
  const obj = new fabric.Rect({
    width: props.width || 100,
    height: props.height || 80,
    fill: props.fill || '#e94560',
    stroke: props.stroke || null,
    strokeWidth: props.strokeWidth || 0,
    left: props.left !== undefined ? props.left : 100,
    top: props.top !== undefined ? props.top : 100,
    rx: props.rx || 0,
    ry: props.ry || 0,
    opacity: props.opacity !== undefined ? props.opacity : 1,
    selectable: false,
    evented: false,
    hoverCursor: 'default'
  })
  obj._id = props.id || ('rect_' + Date.now())
  canvas.add(obj)
  return obj
}

function addTriangle(props) {
  const obj = new fabric.Triangle({
    width: props.width || 100,
    height: props.height || 100,
    fill: props.fill || '#e94560',
    stroke: props.stroke || null,
    strokeWidth: props.strokeWidth || 0,
    left: props.left !== undefined ? props.left : 100,
    top: props.top !== undefined ? props.top : 100,
    opacity: props.opacity !== undefined ? props.opacity : 1,
    selectable: false,
    evented: false,
    hoverCursor: 'default'
  })
  obj._id = props.id || ('triangle_' + Date.now())
  canvas.add(obj)
  return obj
}

function addLine(props) {
  const points = props.points || [0, 0, 100, 100]
  const obj = new fabric.Line(points, {
    stroke: props.stroke || props.fill || '#e94560',
    strokeWidth: props.strokeWidth || 2,
    left: props.left !== undefined ? props.left : 50,
    top: props.top !== undefined ? props.top : 50,
    opacity: props.opacity !== undefined ? props.opacity : 1,
    selectable: false,
    evented: false,
    hoverCursor: 'default'
  })
  obj._id = props.id || ('line_' + Date.now())
  canvas.add(obj)
  return obj
}

function addText(props) {
  const obj = new fabric.Text(props.text || 'Text', {
    fontSize: props.fontSize || 24,
    fontFamily: props.fontFamily || 'PingFang SC, Microsoft YaHei, sans-serif',
    fill: props.fill || '#333333',
    left: props.left !== undefined ? props.left : 100,
    top: props.top !== undefined ? props.top : 100,
    opacity: props.opacity !== undefined ? props.opacity : 1,
    fontWeight: props.fontWeight || 'normal',
    selectable: false,
    evented: false,
    hoverCursor: 'default'
  })
  obj._id = props.id || ('text_' + Date.now())
  canvas.add(obj)
  return obj
}

// ---- 查找对象 ----
function findObjectById(id) {
  return canvas.getObjects().find(obj => (obj._id || obj.id) === id)
}

// ---- 修改对象 ----
function modifyObject(id, props) {
  const obj = findObjectById(id)
  if (!obj) {
    console.warn(`未找到 id=${id} 的对象`)
    return false
  }
  Object.keys(props).forEach(key => {
    const val = props[key]
    if (key === 'left' || key === 'top' || key === 'width' || key === 'height' || key === 'radius') {
      // 支持相对值 "+50" / "-30"
      if (typeof val === 'string' && (val.startsWith('+') || val.startsWith('-'))) {
        const delta = parseFloat(val)
        const currentVal = key === 'radius' ? obj.radius : obj[key]
        obj.set(key, (currentVal || 0) + delta)
      } else {
        obj.set(key, val)
      }
    } else {
      obj.set(key, val)
    }
  })
  obj.setCoords()
  canvas.renderAll()
  return true
}

// ---- 删除对象 ----
function deleteObject(id) {
  const obj = findObjectById(id)
  if (!obj) {
    console.warn(`未找到 id=${id} 的对象用于删除`)
    return false
  }
  canvas.remove(obj)
  canvas.renderAll()
  return true
}

// ---- 获取画布中心 ----
function getCenter() {
  return {
    x: canvas.getWidth() / 2,
    y: canvas.getHeight() / 2
  }
}

// ---- 解析坐标 (支持 "center" 和相对坐标) ----
function resolvePosition(coord, canvasSize, objSize) {
  if (coord === 'center' || coord === 'middle') {
    return canvasSize / 2 - (objSize || 0) / 2
  }
  if (typeof coord === 'string' && (coord.startsWith('+') || coord.startsWith('-'))) {
    return parseFloat(coord)
  }
  return Number(coord) || 0
}

defineExpose({
  clearCanvas,
  undoAction,
  redoAction,
  getCanvasState,
  getObjectList,
  addCircle,
  addRect,
  addTriangle,
  addLine,
  addText,
  findObjectById,
  modifyObject,
  deleteObject,
  getCenter,
  resolvePosition
})
</script>
