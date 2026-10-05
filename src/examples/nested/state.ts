import { createStore } from '../../index'
import { useState } from 'react'

export interface Player {
    name: string
    score: number
    city: string
}

const first: Player = { name: 'Ada', score: 8, city: 'Hanoi' }
const cities = ['Hanoi', 'Hue', 'Da Nang', 'Saigon']
export const tierOf = (score: number) => score >= 10 ? 'gold' : 'silver'

// The source keeps the player as one object, the way a socket or an API hands it over:
// every action replaces the whole object.
const usePlayerState = () => {
    const [player, setPlayer] = useState(first)
    const addPoint = () => setPlayer(p => ({ ...p, score: p.score + 1 }))
    const rename = () => setPlayer(p => ({ ...p, name: p.name === 'Ada' ? 'Grace' : 'Ada' }))
    const move = () => setPlayer(p => ({ ...p, city: cities[(cities.indexOf(p.city) + 1) % cities.length]! }))
    const resend = () => setPlayer(p => ({ ...p })) // the same values in a new object
    return { player, addPoint, rename, move, resend }
}

export const { useStore: usePlayerStore } = createStore('player', usePlayerState)

// One shared store spreads the player into top-level keys and derives the tier once per message.
// It costs one more store render per message; each reader then subscribes to one key.
const usePlayerFieldsState = () => {
    const { player } = usePlayerStore()
    return { ...player, tier: player ? tierOf(player.score) : undefined }
}

export const { useStore: usePlayerFields } = createStore('player-fields', usePlayerFieldsState)
