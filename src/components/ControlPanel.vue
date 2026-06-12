<template>
  <div class="control-panel">
    <div class="panel-title">🎙️ AI 语音绘图</div>

    <!-- 浏览器兼容性警告 -->
    <div v-if="!isASRSupported" class="compat-warning">
      ⚠️ 您的浏览器不支持语音识别，请使用 <strong>Chrome</strong> 或 <strong>Edge</strong> 浏览器
    </div>

    <!-- 麦克风按钮 -->
    <div class="mic-btn-wrapper">
      <button
        class="mic-btn"
        :class="{ listening: isListening }"
        :disabled="!isASRSupported"
        @click="$emit('toggleMic')"
        :title="isListening ? '点击停止' : '点击开始说话'"
      >
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <template v-if="!isListening">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </template>
          <template v-else>
            <rect x="6" y="6" width="12" height="12" rx="2"/>
          </template>
        </svg>
      </button>
    </div>
    <div class="mic-status" :class="{ active: isListening }">
      {{ isListening ? '🔴 正在录音...' : '点击麦克风开始说话，请使用edge浏览器' }}
    </div>

    <!-- 文字输入备用 -->
    <div class="text-input-section">
      <div class="text-input-label">文字输入（语音不可用时使用）</div>
      <div class="text-input-row">
        <input
          class="text-input-field"
          v-model="textInput"
          placeholder="输入绘图指令"
          @keyup.enter="submitText"
        />
        <button class="text-submit-btn" @click="submitText" :disabled="!textInput.trim()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 语音识别文本 -->
    <div class="status-section">
      <div class="status-label">识别文本</div>
      <div class="status-content">{{ recognizedText || '（等待语音输入）' }}</div>
    </div>

    <!-- AI 状态 -->
    <div class="status-section">
      <div class="status-label">AI 状态</div>
      <div class="status-content">{{ aiStatus }}</div>
    </div>

    <!-- AI 提问/澄清 -->
    <div v-if="aiQuestion" class="status-section">
      <div class="status-label">AI 提问</div>
      <div class="status-content ai-question">{{ aiQuestion }}</div>
    </div>

    <!-- 画布元素列表 -->
    <div class="status-section">
      <div class="status-label">画布元素 ({{ objects.length }})</div>
      <div class="objects-list">
        <div
          v-for="obj in objects"
          :key="obj.id"
          class="object-item"
        >
          <strong>[{{ obj.type }}]</strong>
          {{ obj.id }}
          <span v-if="obj.fill && obj.fill !== 'transparent'" :style="{ color: obj.fill }"> ●</span>
          <span v-if="obj.text"> "{{ obj.text }}"</span>
        </div>
        <div v-if="objects.length === 0" style="color:#b0b8c1;font-size:11px;">
          画布为空，请说话添加图形
        </div>
      </div>
    </div>

    <!-- LLM API Key 配置 (可折叠) -->
    <details class="config-section">
      <summary class="config-summary">⚙️ LLM 配置</summary>
      <div class="config-body">
        <div class="config-field">
          <label class="config-label">模型</label>
          <select
            class="config-input"
            :value="model"
            @change="onModelChange"
          >
            <option value="gpt-4o-mini">GPT-4o-mini</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="deepseek-chat">DeepSeek V3</option>
            <option value="deepseek-reasoner">DeepSeek R1</option>
            <option value="deepseek-v4-flash">DeepSeek V4 Flash</option>
            <option value="deepseek-v4-pro">DeepSeek V4 Pro</option>
            <option value="glm-4-flash">GLM-4 Flash (免费)</option>
            <option value="glm-4">GLM-4</option>
            <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
          </select>
        </div>
        <div class="config-field">
          <label class="config-label">API 地址</label>
          <input
            type="text"
            class="config-input"
            :value="apiUrl"
            @input="$emit('updateApiUrl', $event.target.value)"
            placeholder="自动填充或手动输入"
          />
        </div>
        <div class="config-field">
          <label class="config-label">API Key</label>
          <input
            type="password"
            class="config-input"
            :value="apiKey"
            @input="$emit('updateApiKey', $event.target.value)"
            placeholder="sk-... (留空使用本地引擎)"
          />
        </div>
      </div>
    </details>

    <!-- 快捷指令提示 -->
    <div class="status-section quick-hints">
      <div class="status-label">语音指令示例</div>
      <div><span>清空画布</span> / <span>撤销</span> — 本地执行</div>
      <div><span>画一个红色圆圈</span></div>
      <div><span>把它变成蓝色</span></div>
      <div><span>画一个笑脸</span></div>
      <div><span>删除最大的那个</span></div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  isListening: Boolean,
  recognizedText: String,
  aiStatus: String,
  aiQuestion: String,
  isASRSupported: { type: Boolean, default: true },
  apiKey: { type: String, default: '' },
  apiUrl: { type: String, default: '' },
  model: { type: String, default: 'gpt-4o-mini' },
  objects: { type: Array, default: () => [] }
})

const emit = defineEmits(['toggleMic', 'updateApiKey', 'updateApiUrl', 'updateModel', 'submitText'])

const textInput = ref('')
const isSubmitting = ref(false)

function submitText() {
  if (isSubmitting.value) return
  const val = textInput.value.trim()
  if (!val) return
  isSubmitting.value = true
  emit('submitText', val)
  textInput.value = ''
  // 短暂延迟后解锁，等父组件开始处理后即可接受新输入
  setTimeout(() => { isSubmitting.value = false }, 300)
}

// 各厂商默认 API 地址
const modelApiMap = {
  'gpt-4o-mini': 'https://api.openai.com/v1/chat/completions',
  'gpt-4o': 'https://api.openai.com/v1/chat/completions',
  'deepseek-chat': 'https://api.deepseek.com/v1/chat/completions',
  'deepseek-reasoner': 'https://api.deepseek.com/v1/chat/completions',
  'deepseek-v4-flash': 'https://api.deepseek.com/v1/chat/completions',
  'deepseek-v4-pro': 'https://api.deepseek.com/v1/chat/completions',
  'glm-4-flash': 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  'glm-4': 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  'claude-3-5-sonnet': 'https://api.anthropic.com/v1/messages'
}

function onModelChange(e) {
  const newModel = e.target.value
  // 自动切换对应 API 地址
  const defaultUrl = modelApiMap[newModel] || ''
  emit('updateModel', newModel)
  if (defaultUrl) {
    emit('updateApiUrl', defaultUrl)
  }
}
</script>
