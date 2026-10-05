# Events from a store

Some of what a store learns is an event, not state: an order filled, a message arrived, an upload finished. State says what is; an event says what happened, once. Showing a toast per fill, playing a sound or sending analytics reacts to events.

Two ways to do it go wrong:

- **The last event as state.** A `lastFill` key and an effect that watches it miss the events that arrive within one commit, and fire again when the watching component remounts.
- **The store calls the UI.** An account store that calls `push` from the toast store ties the account to the UI. The account's socket effect then needs `push` in its dependencies, so it closes and reopens the socket when `push` arrives, depending on which store started first (see [Before the data arrives](/guide/getting-started#before-the-data-arrives)).

Instead, the store emits the event to listeners, and a store in the UI layer turns it into a toast.

```ts
// stores/core/account.ts: emits each fill once
export const { useStore: useAccount } = createStore('account', () => {
  const [fills, setFills] = useState<Fill[]>([])
  // a ref: listeners stay registered when the socket effect runs again
  const fillListeners = useRef(new Set<(fill: Fill) => void>())

  useEffect(() => socket.subscribe('account', msg => {
    if (msg.type !== 'fill') return
    setFills(list => [msg.fill, ...list])
    for (const listener of fillListeners.current) {
      try { listener(msg.fill) } catch (e) { console.error(e) }   // a broken listener must not stop the stream
    }
  }), [])

  /** Calls `listener` once for each fill from now on; returns the unsubscribe */
  const onFill = (listener: (fill: Fill) => void) => {
    fillListeners.current.add(listener)
    return () => { fillListeners.current.delete(listener) }
  }

  return { fills, onFill }
})

// stores/ui/toasts.ts: one store turns fills into toasts
export const { useStore: useFillToasts } = createStore('fill-toasts', () => {
  const { push } = useToasts()
  const { onFill } = useAccount()
  useEffect(() => {
    if (!push || !onFill) return          // nothing to do until both stores run
    return onFill(fill => push({ title: `Bought ${fill.size} ${fill.symbol}` }))
  }, [push, onFill])
  return {}
})

// App.tsx: start it once
function App() {
  useFillToasts()
  return <>...</>
}
```

## Rules

- **Emit after the store has accepted the message**: after its sequence check, its deduplication, its validation. A listener must never hear about a message the store dropped.
- **Send the whole event.** The store publishes its new state one commit later, so a listener that reads the store to complete the event reads the old state. Put everything the listener needs in the payload.
- **Catch per listener.** One listener that throws must not stop the store from applying the message, nor the other listeners from hearing it.
- **The listener lives in a store, not in a plain hook.** A plain hook called by two components subscribes twice, and each fill shows two toasts. A store has one instance however many components start it. Start it once near the root, or keep it running with `storeRef().retain()`.
- **Listing the actions here is fine.** The effect only subscribes, so running it again when `onFill` or `push` arrives costs nothing, and a restarted account instance gets a new `onFill`, which the effect then subscribes to. Return early while either is missing: without both there is nothing to do.
- **Order does not matter.** The toast store may start before or after the account store, and either may restart. If the toast store fails, the account keeps applying fills; it only loses that listener.

The trading demo's tests (`demos/trading/tests/account.test.tsx`) check two of these: one toast per fill with two components starting the notifier, and a crashing toast store that leaves the account running.
