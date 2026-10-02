import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { Context } from "./ctx";

const OUT_OF_RENDER_ERROR = "useQuickSubscribe: Cannot access context data outside render phase. Destructure needed properties immediately during render."

/**
 * Per-(component, context) tracker behind useQuickSubscribe.
 *
 * - During render the proxy records every key that is read, together with the value seen.
 * - After commit, key subscriptions are diffed against the keys read in the latest render.
 * - A change on any tracked key (by `Object.is`) bumps `version`, which is the
 *   `useSyncExternalStore` snapshot, so React re-renders synchronously and consistently.
 */
function createTracker<D>(ctx: Context<D> | undefined) {
  let open = true
  let version = 0

  const listeners = new Set<() => void>()
  const readKeys = new Set<keyof D>()
  const seen = new Map<keyof D, unknown>()
  const subs = new Map<keyof D, () => void>()

  const data = () => (ctx?.data ?? {}) as Partial<D>

  const proxy = new Proxy(data() as any, {
    get(_target, p) {
      if (!open) throw new Error(OUT_OF_RENDER_ERROR)
      const key = p as keyof D
      const value = data()[key]
      readKeys.add(key)
      seen.set(key, value)
      return value
    },
    ownKeys(target) {
      console.warn("useQuickSubscribe: Rest object operations aren't recommended as they bypass selective subscription and may cause performance issues")
      return Reflect.ownKeys(target)
    },
  }) as { [P in keyof D]?: D[P] | undefined }

  const hasChanged = () => {
    const current = data()
    for (const key of readKeys) {
      if (!Object.is(seen.get(key), current[key])) return true
    }
    return false
  }

  const check = () => {
    if (hasChanged()) {
      version++
      listeners.forEach(l => l())
    }
  }

  return {
    proxy,
    /** Called at the start of every render: reopen the getter and forget last render's reads. */
    beginRender() {
      open = true
      readKeys.clear()
    },
    /** Called after every commit: close the getter and sync key subscriptions to what was read. */
    commit() {
      open = false
      if (ctx) {
        for (const key of readKeys) {
          if (!subs.has(key)) subs.set(key, ctx.subscribe(key, check))
        }
      }
      for (const [key, unsub] of subs) {
        if (!readKeys.has(key)) {
          unsub()
          subs.delete(key)
        }
      }
      // catch anything published between render and commit
      check()
    },
    dispose() {
      subs.forEach(unsub => unsub())
      subs.clear()
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    getSnapshot: () => version,
  }
}

/**
 * useQuickSubscribe is a custom React hook for efficiently subscribing to specific properties of a context's data object.
 * 
 * @template D - The shape of the context data.
 * @param {Context<D> | undefined} ctx - The context object containing data and a subscribe method.
 * @returns {Partial<D>} A proxy object that mirrors the context data, automatically subscribing to properties as they are accessed.
 *
 * This hook tracks which properties of the context data are accessed by the component and subscribes to updates for only those properties.
 * When any of the subscribed properties change, the hook triggers a re-render. Subscriptions are managed and cleaned up automatically
 * when the component unmounts or the context changes. This approach minimizes unnecessary re-renders and resource usage by only
 * subscribing to the data that the component actually uses.
 *
 * The proxy may only be read during render; reading it later (e.g. in an event handler) throws.
 * When `ctx` is undefined every property reads as `undefined` and nothing is subscribed.
 *
 * Example usage:
 *   const {name} = useQuickSubscribe(userContext);
 *   // Accessing name will subscribe to changes in 'name' only
 *   return <div>{name}</div>;
 */
export const useQuickSubscribe = <D>(
  ctx: Context<D> | undefined
): {
    [P in keyof D]?: D[P] | undefined;
  } => {

  const tracker = useMemo(() => createTracker(ctx), [ctx])

  useSyncExternalStore(tracker.subscribe, tracker.getSnapshot, tracker.getSnapshot)

  tracker.beginRender()

  // no deps: subscriptions must follow the keys read in *every* render
  useEffect(() => { tracker.commit() })

  useEffect(() => () => tracker.dispose(), [tracker])

  return tracker.proxy
};
