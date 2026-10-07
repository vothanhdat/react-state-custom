# Rules

A store is a React hook, so what you know about hooks holds inside it. These are the rules the library adds, one line each, with the page that explains it.

1. **A store hook returns an object.** `return { count, setCount }`, not `return useState(0)`: each key is published and tracked on its own. → [`useFn`](/api/create-store#usefn)

2. **Mount one `AutoRootCtx`, inside the providers your stores use.** Store hooks run in it, so `useContext` in a store reads the providers above `AutoRootCtx` (query client, router, i18n), not the ones around the component that reads the store. → [AutoRootCtx](/api/auto-root-ctx)

3. **Same name and params, same instance.** Params are primitives, in a new object each call: never change one you passed. Every caller with the same params shares everything the hook holds, so keep what belongs to one view (a cursor, a selection) in the component, or in the params. Store names are global: keep them unique. → [What an instance shares](/guide/parameterized-stores#what-an-instance-shares)

4. **Every key is `undefined` until the store has run.** A store starts when its first reader mounts, so that reader's first render has nothing yet: default at the read (`count ?? 0`), and default arrays and objects to a constant defined once. → [Before the data arrives](/guide/getting-started#before-the-data-arrives)

5. **Call actions with `?.()` from handlers, and load in the store.** An action is `undefined` before the store has run, so a call from a reader's render or mount effect does nothing. Fetches and subscriptions go in the store's own effects. → [Before the data arrives](/guide/getting-started#before-the-data-arrives)

6. **Read during render.** Destructure what you need at the top of the component: those reads subscribe it. A read in a handler, an effect or a child's own render is not tracked. In a handler, use the value you destructured or `storeRef(params).get()`. Don't spread the proxy or list it as a dependency, and pass a child values, not the proxy. → [Reads outside render](/guide/reads-outside-render)

7. **Tracking is per top-level key.** Return fields as their own keys and collections as objects keyed by id; read deep or derived values with `select`. → [Selectors](/guide/selectors)

8. **Each store layer adds a commit.** A store publishes one commit after the stores it reads, so for one render a component that reads two layers can see a new value next to an old one. Check values before you read them, join by id, and make decisions from one store. → [Data across stores](/guide/how-it-works#data-across-stores)

9. **A store that throws throws in its readers.** Put error boundaries around the parts of the screen that can fail on their own, and keep expected failures, such as a request that fails, as state in the store. → [Error handling](/guide/error-handling)

10. **An instance stops when its last reader leaves.** `timeToClean` keeps it running for a while after that; `storeRef(params).retain()` keeps it running for code outside React. → [`timeToClean`](/guide/store-options#timetoclean)

Beyond these rules, how to split the stores of an app as it grows: [Organizing stores in layers](/guide/layers).
