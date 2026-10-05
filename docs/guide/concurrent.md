# Concurrent rendering

Stores keep loading and progress in their own state (`isLoading`, values that stay `undefined` until they arrive; see [Progressive data](/guide/progressive-data)), so most apps need none of the features on this page. It is for apps that combine stores with transitions, deferred values or `<Activity>`.

A store is React state inside a headless component, and its consumers read it through `useSyncExternalStore`. That decides how stores behave with these features.

## Transitions

A transition (`startTransition`, `useTransition`) marks an update as non-urgent. React renders it in the background, gives way to clicks and typing in between, and keeps the current UI on screen instead of showing a Suspense fallback while something new loads.

- **Params in a transition work as usual.** The new instance starts when the transition commits; its readers render their loading state until it has run.
- **A store action in a transition stops at the store.** The store renders as a transition, but its consumers update in a blocking render once it publishes: React renders every change of an external store as blocking, even inside a transition. Zustand and Redux behave the same way.

To keep the UI responsive while many consumers update, defer the expensive part instead.

## Keep input responsive with `useDeferredValue`

`useDeferredValue` gives a value that lags behind during an update. React first renders with the previous value, then renders the new one in the background, and drops that render if the value changes again, for example on the next keystroke.

```tsx
export const { useStore: useSearch } = createStore('search', () => {
  const [query, setQuery] = useState('')
  return { query, setQuery }
})

const SearchPage = () => {
  const { query, setQuery } = useSearch()
  const deferredQuery = useDeferredValue(query)
  return <>
    <input value={query ?? ''} onChange={e => setQuery?.(e.target.value)} />
    <div style={{ opacity: query !== deferredQuery ? 0.6 : 1 }}>
      <Results query={deferredQuery ?? ''} />
    </div>
  </>
}

// memoized: in the urgent render its props are unchanged, so it is skipped
const Results = memo(({ query }: { query: string }) => <List items={filter(allItems, query)} />)
```

On each keystroke the input shows the new text right away, and `Results` renders with it in the background. The expensive part must be memoized (`memo`, or the React Compiler); otherwise it renders in the urgent pass anyway.

For a store that changes on its own, such as a price feed, a [`schedule`](/guide/update-cadence) is the other tool: the reader renders less often instead of in the background.

## Load in parallel

A store that keeps its loading state in its values never holds back a commit: every reader commits right away and every store starts at once. Only Suspense can make a store wait. `useStore` starts its store from an effect, once the component has committed, and a component in a boundary that is showing its fallback has rendered but not committed, so its store waits for the boundary. Give independent sections their own boundary, or keep loading state in the stores.

To start a store before its screen renders, for example a screen behind a lazy component, retain it from a hover handler or a route loader. The screen's readers attach to the same instance:

```ts
const prefetchUser = (userId: string) => {
  const release = userRef({ userId }).retain()
  setTimeout(release, 10_000) // once mounted, the screen's readers keep it running
}

<Link to={`/users/${id}`} onMouseEnter={() => prefetchUser(id)}>
```

See [Outside React](/guide/outside-react#retain).

## Hidden content with `<Activity>`

React 19.2's `<Activity mode="hidden">` keeps the state of hidden components but cleans up their effects. A `useStore` inside it releases its instance as an unmount would: if it was the last consumer, the instance is torn down after `timeToClean`, and showing the content again starts a fresh instance whose hook state starts over.

To keep a store's state while its consumers are hidden:

- **`timeToClean` longer than the content stays hidden.** The instance keeps running while hidden, effects and subscriptions included.
- **The values in a store of their own**, with a long `timeToClean` and no effects, while the resource runs in another. See [Keeping the values, not the resource](/guide/store-options#keeping-the-values-not-the-resource).
- **Another reader that stays visible**, or `storeRef(params).retain()`.

Keep `AutoRootCtx` outside every `<Activity>`. Hiding it stops every store, and when it is shown again every store starts over, for the consumers outside the hidden part too.
