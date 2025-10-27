import { debounce, memoize } from "./utils";
import { useEffect, useMemo, useState } from "react"
import { useArrayChangeId } from "./useArrayChangeId"



const CHANGE_EVENT = "@--change-event"

class DataEvent<D> extends Event {
  constructor(
    public event: keyof D,
    public value: D[typeof event] | undefined
  ) {
    super(String(event));
  }
}

class ChangeEvent<D> extends Event {
  constructor(
    public value: DataEvent<D>
  ) {
    super(CHANGE_EVENT, value);
  }
}

/**
 * Generic context for managing shared state and event subscriptions.
 * @template D - The shape of the data managed by the context.
 */
export class Context<D> extends EventTarget {
  /**
   * Create a new Context instance.
   * @param name - The name of the context (for debugging).
   */
  constructor(public name: string) {
    // console.log("[CONTEXT] %s", name)
    // this.event.setMaxListeners(100)
    super();
  }

  /**
   * The current data held by the context.
   */
  public data: Partial<D> = {}
  /**
   * Registry for tracking active keys (for duplicate detection).
   */
  public registry = new Set<string>()

  public useCounter = 0

  /**
   * Publish a value to the context and notify subscribers if it changed.
   * @param key - The key to update.
   * @param value - The new value.
   */
  public publish(key: keyof D, value: D[typeof key] | undefined) {

    if (value != this.data[key]) {
      this.data[key] = value
      let event = new DataEvent(key, value);
      this.dispatchEvent(event);
      this.dispatchEvent(new ChangeEvent(event))
    }
  }

  /**
   * Subscribe to changes for a specific key in the context.
   * @param key - The key to subscribe to.
   * @param _listener - Callback invoked with the new value.
   * @returns Unsubscribe function.
   */
  public subscribe(key: keyof D, _listener: (e: D[typeof key] | undefined) => void) {

    const listener = ({ event, value }: any) => {
      _listener(value)
    }

    this.addEventListener(String(key), listener)
    // console.log("listenerCount:", String(key), this.event.listenerCount(String(key)))

    if (key in this.data) _listener(this.data[key])

    return () => this.removeEventListener(String(key), listener)
  }

  public subscribeAll(_listener: (changeKey: keyof D, newData: Partial<D>) => void) {

    const listener = (event: any) => {
      if (event instanceof ChangeEvent) {
        const { value: data } = event
        _listener(data.event as any as keyof D, this.data)
      }
    }

    this.addEventListener(String(CHANGE_EVENT), listener)

    return () => this.removeEventListener(String(CHANGE_EVENT), listener)

  }

}

/**
 * Get or create a memoized Context instance by name.
 * @param name - The context name.
 * @returns The Context instance.
 */
export const getContext = memoize((name: string) => new Context<any>(name))

/**
 * Type alias for a function that returns a Context instance.
 */
export type getContext<D> = (e: string) => Context<D>

/**
 * React hook to get a typed Context instance by name.
 * @param name - The context name.
 * @returns The Context instance.
 */
export const useDataContext = <D>(name: string = "noname") => {
  const ctx = useMemo(() => getContext(name), [name])
  useEffect(() => {
    ctx.useCounter += 1;
    return () => {
      ctx.useCounter -= 1;
      if (ctx.useCounter <= 0) {
        setTimeout(() => {
          if (ctx.useCounter <= 0) {
            getContext.cache.delete(JSON.stringify([name]))
          }
        }, 100)
      }
    }
  }, [ctx])

  return ctx as any as Context<D>
}

/**
 * Internal hook to check for duplicate registry entries in a context.
 * Warns if any of the provided names are already registered.
 * @param ctx - The context instance.
 * @param names - Names to check and register.
 */
const useRegistryChecker = (ctx: Context<any> | undefined, ...names: string[]) => {
  // return;
  const stack = new Error("[ctx] useRegistryChecker failed " + JSON.stringify({ names, ctx: ctx?.name ?? 'undefined' }))

  useEffect(
    () => {
      if (ctx) {
        if (names.some(name => ctx.registry.has(name))) {
          // console.error(stack)
        }
        names.forEach(e => ctx.registry.add(e))

        // console.debug("[ctx] %s%s add datasource", componentId, ctx.name, names)
        return () => {
          // console.debug("[ctx] %s %s remove datasource", componentId, ctx.name, names)

          names.forEach(e => ctx.registry.delete(e))
        }
      }
    },
    [ctx, names.length]
  )

}

/**
 * React hook to publish a value to the context when it changes.
 * @param ctx - The context instance.
 * @param key - The key to update.
 * @param value - The new value.
 */
export const useDataSource = <D, K extends keyof D>(ctx: Context<D> | undefined, key: K, value: D[K] | undefined) => {
  //@ts-check
  useEffect(() => {
    if (ctx && ctx.data[key] != value) {

      ctx.publish(key, value)
    }
  }, [key, value, ctx])

  useRegistryChecker(ctx, key as any)
}

/**
 * React hook to subscribe to a context value, with optional debounce.
 * @param ctx - The context instance.
 * @param key - The key to subscribe to.
 * @param debounceTime - Debounce time in ms (default 0).
 * @returns The current value for the key.
 */
export const useDataSubscribe = <D, K extends keyof D>(ctx: Context<D> | undefined, key: K, debounceTime = 0): D[K] | undefined => {
  //@ts-check
  const [{ value }, setState] = useState(() => ({ value: ctx?.data?.[key] }))

  useEffect(() => {
    if (ctx) {
      let callback = debounceTime == 0
        ? (value: any) => setState({ value } as any)
        : debounce((value: any) => setState({ value } as any), debounceTime)
      let unsub = ctx.subscribe(key, callback)
      value != ctx.data[key] && setState({ value: ctx.data[key] })
      return () => {
        unsub()
      }
    }
  }, [key, ctx])

  return ctx?.data[key]
}

/**
 * React hook to subscribe to a context value and transform it before returning.
 * @param ctx - The context instance.
 * @param key - The key to subscribe to.
 * @param transform - Function to transform the value.
 * @returns The transformed value.
 */
export const useDataSubscribeWithTransform = <D, K extends keyof D, E>(ctx: Context<D> | undefined, key: K, transform: (e: D[K] | undefined) => E): E => {
  const [, setState] = useState(0)
  const result = useMemo(
    () => transform(ctx?.data[key]),
    [transform, ctx?.data[key]]
  )

  useEffect(() => {
    if (ctx) {
      let preValue = result
      let callback = () => {
        let newValue = transform(ctx.data[key])
        if (newValue != preValue) {
          preValue = newValue;
          setState(e => e + 1)
        };
      }
      let unsub = ctx.subscribe(key, callback)
      callback();
      return () => unsub()
    }
  }, [key, ctx])

  return result
}

/**
 * React hook to publish multiple values to the context.
 * @param ctx - The context instance.
 * @param entries - Array of [key, value] pairs to update.
 */
export const useDataSourceMultiple = <D, T extends readonly (keyof D)[]>(
  ctx: Context<D> | undefined,
  ...entries: { -readonly [P in keyof T]: [T[P], D[T[P]]] }
) => {
  //@ts-check
  useEffect(() => {
    if (ctx) {
      for (let [key, value] of entries) {
        ctx.data[key] != value && ctx.publish(key, value)
      }
    }
  }, [ctx, useArrayChangeId(entries.flat())])

  useRegistryChecker(ctx, ...entries.map(e => e[0]) as any)

}

/**
 * React hook to subscribe to multiple context values.
 * @param ctx - The context instance.
 * @param keys - Keys to subscribe to.
 * @returns An object with the current values for the keys.
 */
export const useDataSubscribeMultiple = <D, K extends (keyof D)[]>(
  ctx: Context<D> | undefined,
  ...keys: K
): { [i in keyof K]: D[K[i]] | undefined } => {
  const [, setCounter] = useState(0)

  const returnValues = keys.map(key => ctx?.data?.[key])

  useEffect(() => {
    if (ctx) {
      let prevValues = returnValues
      const callback = debounce(() => {
        let currentValues = keys.map(key => ctx?.data?.[key])
        if (keys.some((key, i) => prevValues[i] != currentValues[i])) {
          // console.log("DIFF", keys.filter((e, i) => prevValues[i] != currentValues[i]))
          prevValues = currentValues
          setCounter(c => c + 1)
        }
      }, 1)

      let handles = keys.map(key => ctx.subscribe(key, callback))

      let firstCall = setTimeout(callback, 1);

      return () => {
        clearTimeout(firstCall)
        callback.cancel();
        handles.forEach(unsub => unsub())
      }

    }
  }, [ctx, ...keys])


  return Object
    .fromEntries(keys.map((key, index) => [key, returnValues[index]])) as any
}

/**
 * React hook to subscribe to multiple context values with throttling.
 * @param ctx - The context instance.
 * @param debounceTime - Debounce time in ms (default 50).
 * @param keys - Keys to subscribe to.
 * @returns Array of current values for the keys.
 */
export const useDataSubscribeMultipleWithDebounce = <D, K extends (keyof D)[]>(
  ctx: Context<D> | undefined,
  debounceTime = 50,
  ...keys: K
): { [i in keyof K]: D[K[i]] | undefined } => {
  //@ts-check
  const [, setCounter] = useState(0)

  const returnValues = keys.map(key => ctx?.data?.[key])

  useEffect(() => {
    if (ctx) {
      let prevValues = returnValues
      const callback = debounce(() => {
        let currentValues = keys.map(key => ctx?.data?.[key])
        if (keys.some((key, i) => prevValues[i] != currentValues[i])) {
          prevValues = currentValues
          setCounter(c => c + 1)
        }
      }, debounceTime)

      let handles = keys.map(key => ctx.subscribe(key, callback))

      let firstCall = setTimeout(callback, 1);

      return () => {
        clearTimeout(firstCall)
        callback.cancel();
        handles.forEach(unsub => unsub())
      }

    }
  }, [ctx, ...keys])

  return returnValues as any
}



