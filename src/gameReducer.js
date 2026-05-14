const BIOME_SKINS = [
  { name: 'Deep Ocean', background: '#050d12', accent: '#4ef2ff' },
  { name: 'Volcanic Vent', background: '#140a0a', accent: '#ff6a4a' },
  { name: 'Alien Jungle', background: '#07140f', accent: '#66ffb0' },
  { name: 'Ice Shelf', background: '#071625', accent: '#9ad9ff' },
]

const EVOLUTION_SKILLS = {
  flagella: { label: 'Flagella Spin', cost: 25, requires: [] },
  photosynthesis: { label: 'Chlorophyll Shift', cost: 60, requires: ['flagella'] },
  jellyfish: { label: 'Gelatin Bell', cost: 140, requires: ['photosynthesis'] },
  coral: { label: 'Fractal Polyps', cost: 180, requires: ['photosynthesis'] },
  fish: { label: 'Biolume Predator', cost: 240, requires: ['jellyfish'] },
}

const makeCell = (id, x, y, stage = 'cell') => ({
  id,
  x,
  y,
  age: 0,
  radius: stage === 'plant' ? 9 : 8,
  stage,
  hue: stage === 'plant' ? 130 : 190,
  splitCooldown: 0,
})

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const randomBetween = (min, max) => min + Math.random() * (max - min)

const addLog = (state, message) => ({
  ...state,
  logs: [message, ...state.logs].slice(0, 6),
})

const createInitialState = () => ({
  energy: 8,
  dnaTokens: 0,
  biomeLevel: 0,
  selectedSkin: 0,
  tick: 0,
  nextId: 2,
  cells: [makeCell(1, 0.5, 0.5)],
  algaeBlooms: [],
  jellyfish: [],
  coral: [],
  fish: [],
  logs: ['The abyss blinks. A lone cell awakens.'],
  skills: {
    flagella: false,
    photosynthesis: false,
    jellyfish: false,
    coral: false,
    fish: false,
  },
  ambientSound: false,
})

const canUnlock = (state, skillKey) => {
  const skill = EVOLUTION_SKILLS[skillKey]
  if (!skill || state.skills[skillKey]) {
    return false
  }

  return (
    state.energy >= skill.cost &&
    skill.requires.every((requiredSkill) => state.skills[requiredSkill])
  )
}

const splitCell = (state, cellId, worldWidth = 1, worldHeight = 1) => {
  const cell = state.cells.find((entry) => entry.id === cellId)
  if (!cell || cell.splitCooldown > 0) {
    return state
  }

  const angle = Math.random() * Math.PI * 2
  const offset = 0.06
  const spawnA = makeCell(
    state.nextId,
    clamp(cell.x + Math.cos(angle) * offset, 0.03, worldWidth - 0.03),
    clamp(cell.y + Math.sin(angle) * offset, 0.03, worldHeight - 0.03),
    cell.stage,
  )
  const spawnB = makeCell(
    state.nextId + 1,
    clamp(cell.x - Math.cos(angle) * offset, 0.03, worldWidth - 0.03),
    clamp(cell.y - Math.sin(angle) * offset, 0.03, worldHeight - 0.03),
    cell.stage,
  )

  const remaining = state.cells.filter((entry) => entry.id !== cellId)

  const nextState = {
    ...state,
    energy: state.energy + 1,
    nextId: state.nextId + 2,
    cells: [...remaining, { ...spawnA, splitCooldown: 5 }, { ...spawnB, splitCooldown: 5 }],
  }

  return addLog(nextState, 'Mitosis surge: one pulse becomes two.')
}

const getBiomeLevel = (state) => {
  const plantCells = state.cells.filter((cell) => cell.stage === 'plant').length
  return clamp(Math.floor(plantCells / 6), 0, 3)
}

const maybeSpawnLife = (state, dt) => {
  let nextState = state

  if (state.skills.jellyfish && Math.random() < dt * 0.08 && state.jellyfish.length < 14) {
    nextState = {
      ...nextState,
      jellyfish: [
        ...nextState.jellyfish,
        {
          id: nextState.nextId,
          x: randomBetween(0.12, 0.88),
          y: randomBetween(0.15, 0.85),
          phase: Math.random() * Math.PI * 2,
        },
      ],
      nextId: nextState.nextId + 1,
    }
  }

  if (state.skills.coral && Math.random() < dt * 0.04 && state.coral.length < 10) {
    nextState = {
      ...nextState,
      coral: [
        ...nextState.coral,
        {
          id: nextState.nextId,
          x: randomBetween(0.1, 0.9),
          y: randomBetween(0.55, 0.92),
          growth: 0.4,
        },
      ],
      nextId: nextState.nextId + 1,
    }
  }

  if (state.skills.fish && Math.random() < dt * 0.07 && state.fish.length < 18) {
    nextState = {
      ...nextState,
      fish: [
        ...nextState.fish,
        {
          id: nextState.nextId,
          x: randomBetween(0.1, 0.9),
          y: randomBetween(0.2, 0.8),
          phase: Math.random() * Math.PI * 2,
        },
      ],
      nextId: nextState.nextId + 1,
    }
  }

  return nextState
}

const reducer = (state, action) => {
  switch (action.type) {
    case 'LOAD_STATE':
      return action.payload || state
    case 'CLICK_CELL':
      return splitCell(state, action.cellId)
    case 'CLICK_WORLD': {
      if (state.cells.length > 160) {
        return state
      }

      return splitCell(state, state.cells[0]?.id)
    }
    case 'UNLOCK_SKILL': {
      const { skillKey } = action
      if (!canUnlock(state, skillKey)) {
        return state
      }

      const nextState = {
        ...state,
        energy: state.energy - EVOLUTION_SKILLS[skillKey].cost,
        skills: { ...state.skills, [skillKey]: true },
      }

      return addLog(nextState, `${EVOLUTION_SKILLS[skillKey].label} evolution unlocked.`)
    }
    case 'TOGGLE_SOUND':
      return { ...state, ambientSound: !state.ambientSound }
    case 'SET_SKIN': {
      if (action.index > state.dnaTokens) {
        return state
      }
      return { ...state, selectedSkin: action.index }
    }
    case 'TICK': {
      const dt = action.dt
      const updatedCells = state.cells.map((cell) => {
        const age = cell.age + dt
        const splitCooldown = Math.max(0, cell.splitCooldown - dt)

        if (cell.stage === 'cell' && age > 7 && state.skills.flagella) {
          return {
            ...cell,
            age,
            splitCooldown,
            stage: 'microbe',
            radius: 9,
            hue: 200,
          }
        }

        if (cell.stage === 'microbe' && age > 15 && state.skills.photosynthesis) {
          return {
            ...cell,
            age,
            splitCooldown,
            stage: 'plant',
            radius: 10,
            hue: 132,
          }
        }

        return { ...cell, age, splitCooldown }
      })

      const algaeBlooms = updatedCells
        .filter((cell) => cell.stage === 'plant')
        .slice(0, 12)
        .map((cell) => ({ id: cell.id, x: cell.x, y: cell.y, radius: 16 + Math.sin(state.tick + cell.id) * 2 }))

      const passiveIncome =
        updatedCells.filter((cell) => cell.stage === 'plant').length * 0.35 +
        state.jellyfish.length * 1.1 +
        state.coral.length * 0.9 +
        state.fish.length * 1.3

      let nextState = {
        ...state,
        tick: state.tick + dt,
        cells: updatedCells,
        algaeBlooms,
        coral: state.coral.map((entry) => ({ ...entry, growth: Math.min(1, entry.growth + dt * 0.01) })),
        energy: state.energy + passiveIncome * dt,
      }

      nextState = maybeSpawnLife(nextState, dt)

      const nextBiomeLevel = getBiomeLevel(nextState)
      if (nextBiomeLevel > state.biomeLevel) {
        nextState = addLog(nextState, 'Biome bloom detected. New life signatures ripple outward.')
      }

      return { ...nextState, biomeLevel: nextBiomeLevel }
    }
    case 'PRESTIGE': {
      const nextTokenCount = state.dnaTokens + 1
      const nextState = createInitialState()
      return {
        ...nextState,
        dnaTokens: nextTokenCount,
        selectedSkin: Math.min(nextTokenCount, BIOME_SKINS.length - 1),
        logs: ['The Great Filter passes. DNA memory survives.'],
      }
    }
    default:
      return state
  }
}

export { BIOME_SKINS, EVOLUTION_SKILLS, createInitialState, reducer }
