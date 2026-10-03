# Concurrent rendering

A store is React state inside a headless component, and its consumers read it through `useSyncExternalStore`. That decides how stores behave with transitions, deferred values, Suspense and `<Activity>`.

## Transitions

A transition (`startTransition`, `useTransition`) marks an update as non-urgent. React renders it in the background, gives way to clicks and typing in between, and keeps the current UI on screen instead of showing a Suspense fallback while something new loads.

- **Params in a transition work as usual.** Switch the params of a `useStoreSuspense` consumer inside `startTransition` and React keeps the previous content until the new instance is ready. See [Suspense](/guide/suspense#transitions).
- **A store action in a transition stops at the store.** The store renders as a transition, but its consumers update in a blocking render once it publishes: React renders every change of an external store as blocking, even inside a transition. Zustand and Redux behave the same way.

To keep the UI responsive while many consumers update, defer the expensive part instead.

## Keep input responsive with `useDeferredValue`

`useDeferredValue` gives a value that lags behind during an update. React first renders with the previous value, then renders the new one in the background, and drops that render if the value changes again, for example on the next keystroke.

```tsx
export const { useStore: useSearch } = createStore('search', () => {
  const [query, setQuery] = useState('')
  return { query, setQuery }
}, { initialState: { query: '' } })

const SearchPage = () => {
  const { query, setQuery } = useSearch()
  const deferredQuery = useDeferredValue(query)
  return <>
    <input value={query} onChange={e => setQuery?.(e.target.value)} />
    <div style={{ opacity: query !== deferredQuery ? 0.6 : 1 }}>
      <Results query={deferredQuery} />
    </div>
  </>
}

// memoized: in the urgent render its props are unchanged, so it is skipped
const Results = memo(({ query }: { query: string }) => <List items={filter(allItems, query)} />)
```

On each keystroke the input shows the new text right away, and `Results` renders with it in the background. The expensive part must be memoized (`memo`, or the React Compiler); otherwise it renders in the urgent pass anyway.

## Load in parallel

`useStore` starts its store from an effect, once the component has committed. A component in a Suspense boundary that is showing its fallback has rendered but not committed, so its store waits for the boundary:

```tsx
// Feed's store starts only after the user has loaded: two 200 ms requests take 400 ms
<Suspense fallback={<Spinner />}>
  <Header />  {/* useUserSuspense({ userId }, s => !s.isLoading) */}
  <Feed />    {/* useFeed({ userId }) */}
</Suspense>
```

Either fix starts both at once:

- **Give independent sections their own boundary.** Feed then commits while Header waits.
- **Read every source of the boundary with `useStoreSuspense`.** It starts its store while the component is suspended.

To start a store before its screen renders, for example a screen behind a lazy component, retain it from a hover handler or a route loader. The screen's consumers attach to the same instance:

```ts
const prefetchUser = (userId: string) => {
  const release = getUserStore({ userId }).retain()
  setTimeout(release, 10_000) // once mounted, the screen's consumers keep it running
}

<Link to={`/users/${id}`} onMouseEnter={() => prefetchUser(id)}>
```

`getStore` reaches the global scope only. See [Outside React](/guide/outside-react#retain).

## Hidden content with `<Activity>`

React 19.2's `<Activity mode="hidden">` keeps the state of hidden components but cleans up their effects. A `useStore` inside it releases its instance as an unmount would: if it was the last consumer, the instance is torn down after `timeToClean`, and showing the content again starts a fresh instance whose hook state starts over.

To keep a store's state while its consumers are hidden:

- **`timeToClean` longer than the content stays hidden.** The instance keeps running while hidden, effects and subscriptions included.
- **A warm start from `preState`.** The new instance starts from what the old one published: `useState(preState.count ?? 0)`. Its effects run again, so it fetches or subscribes again. See [`preState`](/guide/store-options#the-prestate-argument).
- **Another consumer that stays visible**, or `getStore(params).retain()`.

Keep `AutoRootCtx` outside every `<Activity>`. Hiding it stops every store, and when it is shown again every store starts over, for the consumers outside the hidden part too.
