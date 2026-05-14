import { useEffect, useMemo, useReducer, useRef } from 'react'
import './App.css'
import { BIOME_SKINS, EVOLUTION_SKILLS, createInitialState, reducer } from './gameReducer'

const STORAGE_KEY = 'verdant-save-v1'

const BIOME_NAMES = [
  'Abyssal Cradle',
  'Blooming Shelf',
  'Luminous Reef',
  'Living Expanse',
]

const safeParseState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return createInitialState()
    }

    const parsed = JSON.parse(raw)
    return {
      ...createInitialState(),
      ...parsed,
      skills: { ...createInitialState().skills, ...parsed.skills },
    }
  } catch {
    return createInitialState()
  }
}

const drawCoralBranch = (ctx, depth, length, sway) => {
  if (depth <= 0) {
    return
  }

  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, -length)
  ctx.stroke()

  ctx.save()
  ctx.translate(0, -length)
  ctx.rotate(0.35 + Math.sin(sway) * 0.05)
  drawCoralBranch(ctx, depth - 1, length * 0.74, sway + 0.4)
  ctx.restore()

  ctx.save()
  ctx.translate(0, -length)
  ctx.rotate(-0.4 + Math.cos(sway * 1.2) * 0.06)
  drawCoralBranch(ctx, depth - 1, length * 0.7, sway + 0.7)
  ctx.restore()
}

function App() {
  const [state, dispatch] = useReducer(reducer, undefined, safeParseState)
  const canvasRef = useRef(null)
  const animationFrameRef = useRef(0)
  const stateRef = useRef(state)
  const audioRef = useRef(null)

  const skin = BIOME_SKINS[Math.min(state.selectedSkin, BIOME_SKINS.length - 1)]
  const biomeName = BIOME_NAMES[Math.min(state.biomeLevel, BIOME_NAMES.length - 1)]

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current
      if (!canvas) {
        return
      }

      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(window.innerWidth * dpr)
      canvas.height = Math.floor(window.innerHeight * dpr)
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    let last = performance.now()

    const step = (time) => {
      const dt = Math.min(0.06, (time - last) / 1000)
      last = time
      dispatch({ type: 'TICK', dt })
      animationFrameRef.current = requestAnimationFrame(step)
    }

    animationFrameRef.current = requestAnimationFrame(step)

    return () => cancelAnimationFrame(animationFrameRef.current)
  }, [])

  useEffect(() => {
    let frameId = 0

    const drawFrame = () => {
      const canvas = canvasRef.current
      if (!canvas) {
        frameId = requestAnimationFrame(drawFrame)
        return
      }

      const snapshot = stateRef.current
      const activeSkin = BIOME_SKINS[Math.min(snapshot.selectedSkin, BIOME_SKINS.length - 1)]
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        frameId = requestAnimationFrame(drawFrame)
        return
      }

      const dpr = window.devicePixelRatio || 1
      const width = canvas.width / dpr
      const height = canvas.height / dpr

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      const gradient = ctx.createLinearGradient(0, 0, 0, height)
      gradient.addColorStop(0, activeSkin.background)
      gradient.addColorStop(1, '#010508')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)

      snapshot.algaeBlooms.forEach((bloom) => {
        const pulse = 0.5 + Math.sin(snapshot.tick * 0.9 + bloom.id) * 0.1
        const radius = bloom.radius * (1 + pulse)
        const x = bloom.x * width
        const y = bloom.y * height
        const haze = ctx.createRadialGradient(x, y, 1, x, y, radius)
        haze.addColorStop(0, 'rgba(87, 255, 150, 0.2)')
        haze.addColorStop(1, 'rgba(0, 40, 24, 0)')
        ctx.fillStyle = haze
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
      })

      snapshot.cells.forEach((cell) => {
        const x = cell.x * width
        const y = cell.y * height
        const wobble = 1 + Math.sin(snapshot.tick * 5 + cell.id) * 0.08

        ctx.save()
        ctx.translate(x, y)
        ctx.shadowBlur = 18
        ctx.shadowColor = `hsl(${cell.hue}, 90%, 65%)`
        ctx.fillStyle = `hsla(${cell.hue}, 90%, 62%, 0.8)`
        ctx.beginPath()
        ctx.arc(0, 0, cell.radius * wobble, 0, Math.PI * 2)
        ctx.fill()

        if (cell.stage === 'microbe' || cell.stage === 'plant') {
          ctx.strokeStyle = 'rgba(106, 247, 255, 0.9)'
          ctx.lineWidth = 2
          ctx.beginPath()
          const tail = cell.radius * 2.6
          const angle = snapshot.tick * 5 + cell.id
          for (let i = 0; i < 8; i += 1) {
            const progress = i / 7
            const px = Math.cos(angle) * tail * progress
            const py = Math.sin(angle + progress * 2.4) * 8 * progress
            if (i === 0) {
              ctx.moveTo(0, 0)
            } else {
              ctx.lineTo(px, py)
            }
          }
          ctx.stroke()
        }
        ctx.restore()
      })

      snapshot.jellyfish.forEach((entry) => {
        const x = entry.x * width
        const y = entry.y * height + Math.sin(snapshot.tick + entry.phase) * 12

        ctx.save()
        ctx.translate(x, y)
        const bellScale = 1 + Math.sin(snapshot.tick * 2.4 + entry.phase) * 0.15
        ctx.fillStyle = 'rgba(196, 104, 255, 0.35)'
        ctx.shadowBlur = 22
        ctx.shadowColor = '#bb84ff'
        ctx.beginPath()
        ctx.ellipse(0, 0, 20, 14 * bellScale, 0, Math.PI, 0, true)
        ctx.fill()

        ctx.strokeStyle = 'rgba(178, 150, 255, 0.75)'
        for (let i = -2; i <= 2; i += 1) {
          ctx.beginPath()
          for (let t = 0; t <= 18; t += 1) {
            const py = t * 2.6
            const px = i * 5 + Math.sin(py * 0.2 + snapshot.tick * 2 + entry.phase + i) * 4
            if (t === 0) {
              ctx.moveTo(px, 2)
            } else {
              ctx.lineTo(px, py)
            }
          }
          ctx.stroke()
        }
        ctx.restore()
      })

      snapshot.coral.forEach((entry, index) => {
        const x = entry.x * width
        const y = entry.y * height

        ctx.save()
        ctx.translate(x, y)
        ctx.strokeStyle = 'rgba(255, 130, 186, 0.8)'
        ctx.lineWidth = 1.6
        ctx.shadowBlur = 12
        ctx.shadowColor = '#ff66c4'
        drawCoralBranch(ctx, 4, 16 * entry.growth, snapshot.tick + index)
        ctx.restore()
      })

      snapshot.fish.forEach((entry) => {
        const phase = snapshot.tick * 0.8 + entry.phase
        const x = entry.x * width + Math.sin(phase) * 42
        const y = entry.y * height + Math.sin(phase * 2) * 14

        ctx.save()
        ctx.translate(x, y)
        const angle = Math.cos(phase) * 0.7
        ctx.rotate(angle)

        ctx.fillStyle = 'rgba(108, 229, 255, 0.75)'
        ctx.shadowBlur = 16
        ctx.shadowColor = '#66ddff'
        ctx.beginPath()
        ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2)
        ctx.fill()

        ctx.beginPath()
        ctx.moveTo(-10, 0)
        ctx.lineTo(-16, 6)
        ctx.lineTo(-16, -6)
        ctx.closePath()
        ctx.fill()

        ctx.fillStyle = '#e6ff96'
        ctx.beginPath()
        ctx.arc(8, -2, 2.4, 0, Math.PI * 2)
        ctx.fill()

        ctx.restore()
      })

      frameId = requestAnimationFrame(drawFrame)
    }

    frameId = requestAnimationFrame(drawFrame)
    return () => cancelAnimationFrame(frameId)
  }, [])

  useEffect(() => {
    if (!state.ambientSound) {
      if (audioRef.current) {
        audioRef.current.oscillators.forEach((oscillator) => oscillator.stop())
        audioRef.current.modulation.stop()
        audioRef.current.context.close()
        audioRef.current = null
      }
      return undefined
    }

    const context = new AudioContext()
    const master = context.createGain()
    master.gain.value = 0.03
    master.connect(context.destination)

    const oscillatorA = context.createOscillator()
    oscillatorA.type = 'sine'
    oscillatorA.frequency.value = 74

    const oscillatorB = context.createOscillator()
    oscillatorB.type = 'triangle'
    oscillatorB.frequency.value = 111

    const lfo = context.createOscillator()
    lfo.frequency.value = 0.07
    const lfoGain = context.createGain()
    lfoGain.gain.value = 20

    oscillatorA.connect(master)
    oscillatorB.connect(master)
    lfo.connect(lfoGain)
    lfoGain.connect(oscillatorA.frequency)

    oscillatorA.start()
    oscillatorB.start()
    lfo.start()

    const interval = window.setInterval(() => {
      oscillatorB.frequency.setTargetAtTime(90 + Math.random() * 50, context.currentTime, 1.5)
    }, 1400)

    audioRef.current = {
      context,
      oscillators: [oscillatorA, oscillatorB],
      modulation: lfo,
      interval,
    }

    return () => {
      window.clearInterval(interval)
      oscillatorA.stop()
      oscillatorB.stop()
      lfo.stop()
      context.close()
      audioRef.current = null
    }
  }, [state.ambientSound])

  const energyDisplay = useMemo(() => Math.floor(state.energy), [state.energy])

  const saturationScore =
    state.cells.length + state.jellyfish.length * 3 + state.coral.length * 4 + state.fish.length * 3
  const readyForPrestige = saturationScore > 240

  const handleCanvasClick = (event) => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const rect = canvas.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height

    const clickedCell = state.cells.find((cell) => {
      const dx = x - cell.x
      const dy = y - cell.y
      return Math.sqrt(dx * dx + dy * dy) < 0.03
    })

    if (clickedCell) {
      dispatch({ type: 'CLICK_CELL', cellId: clickedCell.id })
    } else {
      dispatch({ type: 'CLICK_WORLD' })
    }
  }

  return (
    <div className="verdant-shell" style={{ '--biome-accent': skin.accent }}>
      <canvas ref={canvasRef} className="world-canvas" onClick={handleCanvasClick} />

      <div className="scanlines" aria-hidden="true" />

      <header className="hud topbar">
        <div>Energy: {energyDisplay}</div>
        <div>Biome: {biomeName}</div>
        <div>DNA Tokens: {state.dnaTokens}</div>
      </header>

      <aside className="hud evolution-panel">
        <h2>Evolution Tree</h2>
        <ul>
          {Object.entries(EVOLUTION_SKILLS).map(([skillKey, skill]) => {
            const unlocked = state.skills[skillKey]
            const canAfford = state.energy >= skill.cost
            const dependenciesMet = skill.requires.every((requiredKey) => state.skills[requiredKey])
            return (
              <li key={skillKey}>
                <button
                  type="button"
                  disabled={unlocked || !canAfford || !dependenciesMet}
                  onClick={() => dispatch({ type: 'UNLOCK_SKILL', skillKey })}
                >
                  <span>{skill.label}</span>
                  <small>{unlocked ? 'Unlocked' : `${skill.cost.toFixed(0)} energy`}</small>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="settings">
          <label>
            <input
              type="checkbox"
              checked={state.ambientSound}
              onChange={() => dispatch({ type: 'TOGGLE_SOUND' })}
            />
            Ambient Sound
          </label>

          <label>
            Biome Skin
            <select
              value={state.selectedSkin}
              onChange={(event) => dispatch({ type: 'SET_SKIN', index: Number(event.target.value) })}
            >
              {BIOME_SKINS.map((entry, index) => (
                <option key={entry.name} value={index} disabled={index > state.dnaTokens}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="prestige-button"
            disabled={!readyForPrestige}
            onClick={() => dispatch({ type: 'PRESTIGE' })}
          >
            The Great Filter
          </button>
        </div>
      </aside>

      <footer className="hud ticker" role="status" aria-live="polite">
        {state.logs[0] || 'Silence drifts through the trench.'}
      </footer>

      <div className="flavor-text">
        {state.logs.slice(1).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  )
}

export default App
