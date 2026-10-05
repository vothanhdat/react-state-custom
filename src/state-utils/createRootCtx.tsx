import { useEffect, useRef, useState } from "react"
import { useDataContext, type Context, useIsomorphicLayoutEffect, functionSources, selectorScope, type FunctionSource } from "./ctx"
import { paramsToId, type ParamsToIdRecord, type StoreParamsShape } from "./paramsToId"
import { DependencyTracker } from "./utils"
import { storeMocks } from "./storeRegistry"

type StableFn = FunctionSource & { stable: Function }

/** Arrow functions and methods have no prototype, so the source text is read only for `function`s and classes. */
const isClass = (fn: Function) => fn.prototype !== undefined && /^class[\s{]/.test(Function.prototype.toString.call(fn))

/**
 * Publishes the store's result after each commit, in one pass over its keys.
 *
 * Function-valued keys get a stable identity. Store hooks usually return fresh closures
 * (`const increment = () => ...`) on every render; publishing those directly would notify every
 * consumer that destructures an action on every store render. Instead each function key gets one
 * wrapper that forwards to the latest committed implementation. Classes are left as-is.
 *
 * A function a consumer calls while rendering (a getter such as `getItem(id)`, a component) is a
 * value, not an action: when its implementation changes the key is announced with `Context.touch`,
 * so those consumers re-render. Calls from event handlers never mark a function.
 *
 * Every other value is compared with what the context holds (`Object.is`); changed and removed keys
 * go out in one `publishMany`. O(keys) per commit without intermediate copies or arrays, which
 * matters for collections keyed by id.
 */
const usePublish = (ctx: Context<any>, state: Record<string, unknown>) => {
  const wrappers = useRef(new Map<string, StableFn>()).current
  const last = useRef<{ ctx: Context<any>, state: Record<string, unknown> } | null>(null)

  useIsomorphicLayoutEffect(() => {
    const previous = last.current?.ctx === ctx ? last.current.state : undefined
    last.current = { ctx, state }
    if (previous === state) return
    const data = ctx.data
    let changed: [string, unknown][] | undefined
    let touched: string[] | undefined

    for (const key in state) {
      let value = state[key]
      if (typeof value === "function" && !isClass(value)) {
        const entry = wrappers.get(key)
        if (!entry) {
          value = createStableFn(key, value, wrappers)
        } else {
          if (entry.latest !== value) {
            entry.latest = value
            if (entry.calledInRender) (touched ??= []).push(key)
          }
          value = entry.stable
        }
      } else if (wrappers.size > 0) {
        wrappers.delete(key)
      }
      if (!Object.is(data[key], value)) (changed ??= []).push([key, value])
    }

    let removed: string[] | undefined
    if (previous) {
      for (const key in previous) {
        if (Object.hasOwn(state, key)) continue
        wrappers.delete(key);
        (removed ??= []).push(key)
      }
    }

    if (changed || removed) ctx.publishMany(changed ?? [], removed)
    if (touched) ctx.touch(touched)
  })

  // Once this hook is unmounted (the instance torn down, disabled by an error or restarted), its
  // actions do nothing instead of running closures that can still fetch or subscribe. StrictMode
  // runs the cleanup and the effect again at once, which brings them back.
  useEffect(() => {
    for (const entry of wrappers.values()) entry.dead = false
    return () => { for (const entry of wrappers.values()) entry.dead = true }
  }, [wrappers])
}

const createStableFn = (key: string, value: Function, wrappers: Map<string, StableFn>) => {
  const created: StableFn = {
    latest: value,
    calledInRender: false,
    stable: function (this: unknown, ...args: unknown[]) {
      // Like an action that does not exist yet. No warning: a component inside an <Activity> shown
      // again calls it from its effects once, before the next instance publishes its own.
      if (created.dead) return undefined
      if (selectorScope.depth > 0) created.calledInRender = true
      return created.latest.apply(this, args)
    },
  }
  try {
    Object.defineProperty(created.stable, "name", { value: value.name || key })
  } catch { /* non-configurable in exotic environments; ignore */ }
  functionSources.set(created.stable, created)
  wrappers.set(key, created)
  return created.stable
}


/**
 * The parts of a store that run its hook: `getCtxName(params)` names an instance (`"name?params"`),
 * and `useRootState(params)` runs the hook and publishes what it returns to the instance's context.
 * AutoRootCtx renders `useRootState` once per running instance.
 */
export const createRootCtx = <U extends StoreParamsShape<U>, V extends object>(name: string, useFn: (params: U) => V) => {

  const getCtxName = (e: U) => [name, paramsToId(e as ParamsToIdRecord)]
    .filter(Boolean)
    .join("?");

  const useRootState = (e: U) => {
    const ctxName = getCtxName(e)
    const ctx = useDataContext<V>(ctxName)
    // A test double set with mockStore (react-state-custom/testing) runs in place of the hook, for the
    // whole life of the instance: switching hooks in a running instance would break their order.
    const [mock] = useState(() => storeMocks.get(name))

    DependencyTracker.enter(ctxName);
    let rawState: V;
    try {
      rawState = mock ? mock(e) as V : useFn(e)
    } finally {
      DependencyTracker.leave();
    }

    usePublish(ctx, rawState as Record<string, unknown>)

    // Declared after usePublish so it runs after the first publish: the context is "ready" once
    // readers can see the hook's values instead of nothing.
    useIsomorphicLayoutEffect(() => { ctx.markReady() }, [ctx])

    // One AutoRootCtx runs one instance per name. Two can run at once only while stores move from
    // one AutoRootCtx to another in a different React root, where the old one unmounts in that root's
    // next commit: Context.instances counts them, so the context retires once both are gone.
    return rawState;
  }

  useRootState.displayName = `useState[${name}]`

  return { name, getCtxName, useRootState }
}
