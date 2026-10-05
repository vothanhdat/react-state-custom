// Core: the socket's connection state. Other core stores read `online` to resync after a drop.

import { useEffect, useState } from 'react'
import { createStore } from 'react-state-custom'
import { simControls, socket } from '../../sim/exchange'
import type { ConnectionStatus } from '../../sim/types'

export const { useStore: useConnection } = createStore('connection', () => {
  const [status, setStatus] = useState<ConnectionStatus>(socket.status)
  useEffect(() => socket.onStatus(setStatus), [])
  return { status, online: status === 'open', drop: simControls.dropConnection }
})
