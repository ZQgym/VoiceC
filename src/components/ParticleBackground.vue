<template>
  <canvas ref="canvasRef" class="particle-canvas"></canvas>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const canvasRef = ref(null)
let ctx = null
let animationId = null
let particles = []
let mouse = { x: null, y: null, radius: 150 }
let canvasWidth = 0
let canvasHeight = 0

const PARTICLE_COUNT = 90
const CONNECTION_DIST = 180
// Bright neon colors that pop against dark bg
const COLORS = ['#818cf8', '#a78bfa', '#c084fc', '#38bdf8', '#22d3ee', '#f472b6']

class Particle {
  constructor(w, h) {
    this.x = Math.random() * w
    this.y = Math.random() * h
    this.vx = (Math.random() - 0.5) * 0.6
    this.vy = (Math.random() - 0.5) * 0.6
    this.size = Math.random() * 4 + 3
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)]
    this.baseSize = this.size
  }

  update(w, h) {
    if (mouse.x !== null && mouse.y !== null) {
      const dx = mouse.x - this.x
      const dy = mouse.y - this.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < mouse.radius) {
        const force = (mouse.radius - dist) / mouse.radius
        const angle = Math.atan2(dy, dx)
        this.x += Math.cos(angle) * force * 2
        this.y += Math.sin(angle) * force * 2
        this.size = this.baseSize + force * 6
      } else {
        this.size += (this.baseSize - this.size) * 0.1
      }
    }

    this.x += this.vx
    this.y += this.vy

    if (this.x < -30) this.x = w + 30
    if (this.x > w + 30) this.x = -30
    if (this.y < -30) this.y = h + 30
    if (this.y > h + 30) this.y = -30
  }

  draw(ctx) {
    // Outer glow
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const gradient = ctx.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, this.size * 4
    )
    gradient.addColorStop(0, this.color)
    gradient.addColorStop(0.25, this.color + 'aa')
    gradient.addColorStop(0.55, this.color + '44')
    gradient.addColorStop(1, 'transparent')

    ctx.beginPath()
    ctx.arc(this.x, this.y, this.size * 4, 0, Math.PI * 2)
    ctx.fillStyle = gradient
    ctx.fill()

    // Bright solid core
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.size * 0.7, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.restore()
  }
}

function initParticles() {
  particles = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(new Particle(canvasWidth, canvasHeight))
  }
}

function drawConnections() {
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x
      const dy = particles[i].y - particles[j].y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < CONNECTION_DIST) {
        let opacity = (1 - dist / CONNECTION_DIST) * 0.55

        if (mouse.x !== null && mouse.y !== null) {
          const midX = (particles[i].x + particles[j].x) / 2
          const midY = (particles[i].y + particles[j].y) / 2
          const mdx = mouse.x - midX
          const mdy = mouse.y - midY
          const mDist = Math.sqrt(mdx * mdx + mdy * mdy)
          if (mDist < mouse.radius) {
            opacity = Math.min(1, Math.max(opacity, (1 - mDist / mouse.radius) * 0.85))
          }
        }

        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ctx.beginPath()
        ctx.moveTo(particles[i].x, particles[i].y)
        ctx.lineTo(particles[j].x, particles[j].y)
        const hexOpacity = Math.floor(opacity * 255).toString(16).padStart(2, '0')
        ctx.strokeStyle = particles[i].color + hexOpacity
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.restore()
      }
    }
  }
}

function animate() {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)

  // Draw connections first (under particles)
  drawConnections()

  // Draw all particles with additive blending
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  particles.forEach(p => {
    p.update(canvasWidth, canvasHeight)
    p.draw(ctx)
  })
  ctx.restore()

  animationId = requestAnimationFrame(animate)
}

function resize() {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  canvasWidth = rect.width
  canvasHeight = rect.height
  canvas.width = canvasWidth * window.devicePixelRatio
  canvas.height = canvasHeight * window.devicePixelRatio
  ctx = canvas.getContext('2d')
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

  if (particles.length !== PARTICLE_COUNT) {
    initParticles()
  }
}

function onMouseMove(e) {
  const rect = canvasRef.value.getBoundingClientRect()
  mouse.x = e.clientX - rect.left
  mouse.y = e.clientY - rect.top
}

function onMouseLeave() {
  mouse.x = null
  mouse.y = null
}

function onClick(e) {
  const rect = canvasRef.value.getBoundingClientRect()
  const cx = e.clientX - rect.left
  const cy = e.clientY - rect.top

  particles.forEach(p => {
    const dx = p.x - cx
    const dy = p.y - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 200) {
      const angle = Math.atan2(dy, dx)
      const force = (200 - dist) / 200 * 10
      p.vx = Math.cos(angle) * force + (Math.random() - 0.5) * 3
      p.vy = Math.sin(angle) * force + (Math.random() - 0.5) * 3
    }
  })

  // Spawn burst particles
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * 2 / 10) * i + Math.random() * 0.3
    const p = new Particle(canvasWidth, canvasHeight)
    p.x = cx
    p.y = cy
    p.vx = Math.cos(angle) * (4 + Math.random() * 5)
    p.vy = Math.sin(angle) * (4 + Math.random() * 5)
    p.size = Math.random() * 4 + 4
    p.baseSize = p.size
    p.color = ['#fbbf24', '#f97316', '#ef4444'][Math.floor(Math.random() * 3)]
    particles.push(p)

    setTimeout(() => {
      const idx = particles.indexOf(p)
      if (idx > -1) particles.splice(idx, 1)
    }, 1800)
  }
}

onMounted(() => {
  resize()
  initParticles()
  animate()

  window.addEventListener('resize', resize)
  window.addEventListener('mousemove', onMouseMove)
  canvasRef.value.addEventListener('mouseleave', onMouseLeave)
  canvasRef.value.addEventListener('click', onClick)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', resize)
  window.removeEventListener('mousemove', onMouseMove)
  canvasRef.value?.removeEventListener('mouseleave', onMouseLeave)
  canvasRef.value?.removeEventListener('click', onClick)
})
</script>

<style scoped>
.particle-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: auto;
}
</style>
