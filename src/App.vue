<template>
  <ParticleBackground />
  <div class="app-container">
    <CanvasArea ref="canvasRef" />
    <ControlPanel
      :isListening="isListening"
      :recognizedText="recognizedText"
      :aiStatus="aiStatus"
      :aiQuestion="aiQuestion"
      :objects="canvasObjects"
      :isASRSupported="isASRSupported"
      :apiKey="llmConfig.apiKey"
      :apiUrl="llmConfig.apiUrl"
      :model="llmConfig.model"
      @toggleMic="handleToggleMic"
      @submitText="handleTextSubmit"
      @updateApiKey="handleUpdateApiKey"
      @updateApiUrl="handleUpdateApiUrl"
      @updateModel="handleUpdateModel"
    />
  </div>
</template>

<script setup>
import { ref, provide } from 'vue'
import ParticleBackground from './components/ParticleBackground.vue'
import CanvasArea from './components/CanvasArea.vue'
import ControlPanel from './components/ControlPanel.vue'
import { useSpeechRecognition } from './composables/useSpeechRecognition'
import { parseCommand, getLLMConfig, setLLMConfig } from './utils/llm'
import { executeCommand, generateStateSummary } from './utils/commandExecutor'

// ---- 子组件引用 ----
const canvasRef = ref(null)

// ---- 状态 ----
const isListening = ref(false)
const recognizedText = ref('')
const aiStatus = ref('待命中')
const aiQuestion = ref('')
const llmConfig = ref(getLLMConfig())
const canvasObjects = ref([])

// ---- 简单指令正则拦截 (Step 2 & Step 5: 降低延迟) ----
const simpleCommands = {
  clear: /^(清空|清除|全部删除|清屏|删掉所有|删除全部)/,
  undo: /^(撤销|回退|返回上一步|取消)/,
  redo: /^(重做|恢复)/
}

// ---- 语音识别回调 ----
function onSpeechResult(text) {
  recognizedText.value = text
  handleUserInput(text)
}

function onSpeechError(err) {
  aiStatus.value = '语音识别错误: ' + err
  isListening.value = false
}

// ---- 语音合成 (TTS) ----
function speakMessage(message) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(message)
  utterance.lang = 'zh-CN'
  utterance.rate = 1.0
  utterance.pitch = 1.0
  window.speechSynthesis.speak(utterance)
}

// ---- 核心：处理用户输入 ----
async function handleUserInput(text) {
  const trimmed = text.trim()
  if (!trimmed) return

  // 【意图拦截】先匹配简单指令，降低延迟，不调用 LLM
  if (simpleCommands.clear.test(trimmed)) {
    canvasRef.value?.clearCanvas()
    aiStatus.value = '已清空画布'
    recognizedText.value = ''
    refreshObjectList()
    return
  }
  if (simpleCommands.undo.test(trimmed)) {
    canvasRef.value?.undoAction()
    aiStatus.value = '已撤销'
    recognizedText.value = ''
    refreshObjectList()
    return
  }
  if (simpleCommands.redo.test(trimmed)) {
    canvasRef.value?.redoAction()
    aiStatus.value = '已重做'
    recognizedText.value = ''
    refreshObjectList()
    return
  }

  // 复杂指令：调用 LLM
  aiStatus.value = 'AI 思考中...'
  try {
    const canvasState = canvasRef.value?.getCanvasState() || []
    const result = await parseCommand(trimmed, canvasState)

    if (!result) {
      aiStatus.value = 'LLM 返回为空，请重试'
      return
    }

    const executed = await executeCommand(
      result,
      canvasRef.value,
      speakMessage,
      (q) => { aiQuestion.value = q }
    )
    aiStatus.value = executed ? '执行完成' : '指令执行失败'
    recognizedText.value = ''
    refreshObjectList()
  } catch (err) {
    console.error('处理指令异常:', err)
    aiStatus.value = '处理异常: ' + err.message
  }
}

function refreshObjectList() {
  canvasObjects.value = canvasRef.value?.getObjectList() || []
}

// ---- 麦克风切换 ----
const { start, stop, isSupported: isASRSupported } = useSpeechRecognition(onSpeechResult, onSpeechError)

function handleToggleMic() {
  if (!isASRSupported) {
    aiStatus.value = '您的浏览器不支持 Web Speech API，请使用 Chrome 浏览器'
    return
  }
  if (isListening.value) {
    stop()
    isListening.value = false
    aiStatus.value = '已停止监听'
  } else {
    start()
    isListening.value = true
    aiStatus.value = '正在聆听...'
  }
}

// ---- 文字输入备用 ----
function handleTextSubmit(text) {
  recognizedText.value = text
  handleUserInput(text)
}

// ---- LLM 配置更新 ----
function handleUpdateApiKey(key) {
  llmConfig.value.apiKey = key
  setLLMConfig({ apiKey: key })
}
function handleUpdateApiUrl(url) {
  llmConfig.value.apiUrl = url
  setLLMConfig({ apiUrl: url })
}
function handleUpdateModel(model) {
  llmConfig.value.model = model
  setLLMConfig({ model })
}

// 暴露给子组件
provide('canvasRef', canvasRef)
</script>
