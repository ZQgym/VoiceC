import { ref, onUnmounted } from 'vue'

/**
 * 浏览器原生 Web Speech API 语音识别 Hook
 * 支持中文普通话识别，自动处理连续/非连续模式
 *
 * @param {Function} onDisplay  - 实时显示回调 (中间结果，仅更新 UI)
 * @param {Function} onFinal    - 最终结果回调 (识别结束后触发，执行指令)
 * @param {Function} onError    - 错误回调
 */
export function useSpeechRecognition(onDisplay, onFinal, onError) {
  const isSupported = ref(false)
  let recognition = null
  let finalTranscript = ''
  let finalDispatched = false  // 防止 onend 和 onresult 双重触发

  // 检测浏览器兼容性
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

  if (SpeechRecognition) {
    isSupported.value = true
    try {
      recognition = new SpeechRecognition()
      recognition.lang = 'zh-CN'
      recognition.interimResults = true  // 获取中间结果，提升响应速度
      recognition.continuous = false     // 单次识别模式，避免长时间开放麦克风
      recognition.maxAlternatives = 1
    } catch (e) {
      isSupported.value = false
      console.warn('SpeechRecognition 创建失败:', e)
    }
  }

  function dispatchFinal(text) {
    if (finalDispatched) return
    finalDispatched = true
    onFinal?.(text)
  }

  function start() {
    if (!recognition) {
      onError?.('浏览器不支持语音识别')
      return
    }
    finalTranscript = ''
    finalDispatched = false

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interim += transcript
        }
      }
      // 实时显示识别进度（仅用于 UI 展示，不触发执行）
      const display = finalTranscript + interim
      onDisplay?.(display)
    }

    recognition.onerror = (event) => {
      console.error('语音识别错误:', event.error, event.message)
      const errorMessages = {
        'not-allowed': '麦克风权限被拒绝，请在浏览器设置中允许麦克风访问',
        'no-speech': '未检测到语音，请再试一次',
        'audio-capture': '未找到麦克风设备，请确认设备已连接',
        'network': '语音识别需要连接 Google 服务，当前网络无法访问。请使用下方文字输入框代替',
        'aborted': '识别已中止',
        'service-not-allowed': '语音识别服务不可用，请使用文字输入',
        'bad-grammar': '语法错误',
        'language-not-supported': '不支持当前语言'
      }
      const msg = errorMessages[event.error] || `语音识别错误: ${event.error}`
      finalDispatched = true  // 出错后不再提交
      onError?.(msg)
    }

    recognition.onend = () => {
      // 识别结束，仅在此处触发一次指令执行
      if (finalTranscript.trim()) {
        dispatchFinal(finalTranscript.trim())
      }
    }

    try {
      recognition.start()
    } catch (e) {
      console.error('启动语音识别失败:', e)
      onError?.('启动语音识别失败: ' + e.message)
    }
  }

  function stop() {
    if (recognition) {
      try {
        recognition.stop()
      } catch (e) {
        // 忽略停止时的异常
      }
    }
  }

  // 组件卸载时清理
  onUnmounted(() => {
    stop()
    if (recognition) {
      recognition.onresult = null
      recognition.onend = null
      recognition.onerror = null
    }
  })

  return { start, stop, isSupported }
}
