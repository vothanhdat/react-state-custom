// Core: the simulator's knobs and throughput. In a real app this store would not exist; here it is
// the only way the UI layer reaches the simulator.

import { useEffect, useState } from 'react'
import { createStore } from 'react-state-custom'
import { simControls } from '../../sim/exchange'

export const { useStore: useFeed } = createStore('feed', () => {
  const [speed, setSpeedState] = useState(simControls.getSpeed)
  const [chaos, setChaosState] = useState(simControls.getChaos)
  const [stats, setStats] = useState(simControls.stats)
  useEffect(() => {
    const timer = setInterval(() => setStats(simControls.stats()), 1000)
    return () => clearInterval(timer)
  }, [])
  return {
    speed,
    chaos,
    messagesPerSecond: stats.messagesPerSecond,
    simMsPerSecond: stats.simMsPerSecond,
    setSpeed: (next: number) => { simControls.setSpeed(next); setSpeedState(next) },
    setChaos: (next: boolean) => { simControls.setChaos(next); setChaosState(next) },
  }
}, { timeToClean: 10 * 60_000 })
