# useMultipleStore

Reads several store instances in one call. The refs come from [`storeRef(params)`](/api/create-store#storeref-params), of one store or of several, and their number may change from one render to the next, so a component can read one instance per item of a list.

```ts
import { useMultipleStore } from 'react-state-custom'

function useMultipleStore<const Refs extends readonly StoreRef[]>(
  refs: Refs,
  options?: { schedule?: Scheduler }
): StatesOf<Refs>                        // one StoreState per ref, in order

function useMultipleStore<const Refs extends readonly StoreRef[], R>(
  refs: Refs,
  options: { select: (states: StatesOf<Refs>) => R, isEqual?: (a: R, b: R) => boolean, schedule?: Scheduler }
): R
```

Each instance starts, is shared and stops as it would with `useStore`: one call reading ten refs counts as ten readers. When the list changes, the instances that join start and the ones that leave stop after their `timeToClean`.

## Proxies

Without `select`, it returns one tracking proxy per ref, in the order of `refs`, like `useStore(params)` returns for each. The component re-renders for the keys it read from any of them.

```tsx
const { storeRef: roomRef } = createStore('room', useRoom)

function RoomTabs({ roomIds }: { roomIds: string[] }) {
  const rooms = useMultipleStore(roomIds.map(id => roomRef({ id })))
  return <>{rooms.map((room, i) => <Tab key={roomIds[i]} name={roomIds[i]} unread={room.unread ?? 0} />)}</>
}
```

A tuple of refs is typed by position:

```ts
const [user, cart] = useMultipleStore([userRef(), cartRef({ id })])
user.name   // string | undefined, from the user store
cart.items  // Item[] | undefined, from the cart store
```

## `select`

With `select`, it returns `select(states)` over the plain states, in the order of `refs`, and re-renders only when that value changes. `isEqual` defaults to a shallow comparison (`Object.is` one level deep), so a fresh array with the same items is no change.

```ts
// renders when the total changes, not on every message of every room
const unread = useMultipleStore(roomIds.map(id => roomRef({ id })), {
  select: rooms => rooms.reduce((sum, room) => sum + (room.unread ?? 0), 0),
})
```

`select` runs whenever any of the instances changes. A call site must pass `select` on every render or on none, as with `useStore`.

## Options

- `schedule`: when the component re-renders for a change, for every instance. By default each instance follows its store's `schedule` option. See [Update cadence](/guide/update-cadence).
- `select`, `isEqual`: see above.

## Notes

- **Inside a store hook** it works as in a component: a store can read a list of instances, for example a summary over the per-id stores of a collection.
- **Before an instance has run**, its state is `{}`, as with `useStore`. On the server every state is `{}`, and nothing runs.
- **The refs may be new objects on every render**: instances are matched by name and params, not by the identity of the ref.
- **A failed instance**: the component throws the error of the first instance whose store hook threw, for its error boundary, as `useStore` does. See [Error handling](/guide/error-handling).
- **Not a ref**: an item that `storeRef` did not make throws a `TypeError` naming its index.

See [Rendering a list](/guide/selectors#rendering-a-list) for when to give each item a store of its own and when to keep a collection in one store.
