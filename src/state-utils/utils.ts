/**
 * True in a production build. Development-only code checks this, never `process.env.NODE_ENV` itself:
 * - An app's bundler replaces `process.env.NODE_ENV` with a string, so this becomes a constant and the
 *   minifier drops every development branch with its warning text.
 * - Where nothing replaces it (Node: tests, server rendering of unbundled packages), `process.env` is a
 *   native lookup costing ~150 ns per read, too much for checks that run on every render: read it once.
 * Like React, this needs a bundler or a CDN that defines `process.env.NODE_ENV` in a browser.
 *
 * Keep it the first statement of this file, and this file first in the bundle: esbuild inlines a
 * top-level constant only when no hoisted `function` declaration comes before it.
 */
export const isProduction = process.env.NODE_ENV === 'production'

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const fn = function (...args: Parameters<T>): void {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      timeout = null;
      func(...args);
    }, wait);
  } as ((...args: Parameters<T>) => void) & { cancel: () => void };

  fn.cancel = () => {
    if (timeout) clearTimeout(timeout);
    timeout = null;
  };

  return fn;
}

/**
 * A Map that tells subscribers after every `set`, `delete` or `clear` that changed it.
 * `getContext.cache` is one, so a dev tool can list the live contexts without polling.
 * Listeners run synchronously, possibly during a React render: defer any setState.
 */
export class ObservableMap<K, V> extends Map<K, V> {
  private listeners?: Set<() => void>

  /** Run `listener` after each change. Returns an unsubscribe function. */
  subscribe(listener: () => void) {
    (this.listeners ??= new Set()).add(listener)
    return () => { this.listeners?.delete(listener) }
  }

  private notify() {
    if (this.listeners) for (const listener of [...this.listeners]) listener()
  }

  set(key: K, value: V) {
    const changed = !super.has(key) || super.get(key) !== value
    super.set(key, value)
    if (changed) this.notify()
    return this
  }

  delete(key: K) {
    const had = super.delete(key)
    if (had) this.notify()
    return had
  }

  clear() {
    const had = this.size > 0
    super.clear()
    if (had) this.notify()
  }
}

export type Memoized<T extends (...args: any[]) => any> = ((...args: Parameters<T>) => ReturnType<T>) & {
  cache: ObservableMap<string, ReturnType<T>>,
  /** Return the cached result for these args without creating one. */
  fromCache: (...args: Parameters<T>) => ReturnType<T> | undefined,
  /** The cache key used for these args. */
  keyFor: (...args: Parameters<T>) => string,
}

// Memoize function
export function memoize<T extends (...args: any[]) => any>(func: T): Memoized<T> {

  const cache = new ObservableMap<string, ReturnType<T>>();
  const keyFor = (...args: Parameters<T>) => JSON.stringify(args);

  const cachedFunc: any = function (...args: Parameters<T>): ReturnType<T> {
    const key = keyFor(...args);
    if (cache.has(key)) {
      return cache.get(key) as ReturnType<T>;
    }
    const result = func(...args);
    cache.set(key, result);
    return result;
  }

  cachedFunc.cache = cache;
  cachedFunc.keyFor = keyFor;
  cachedFunc.fromCache = function (...args: Parameters<T>): ReturnType<T> | undefined {
    return cache.get(keyFor(...args));
  }

  return cachedFunc
}

/**
 * JSON text of a store's state for the dev tool's default renderer.
 * Unlike plain `JSON.stringify` it keeps what state objects commonly hold and never throws:
 * functions show as `ƒ name()`, `undefined`, `bigint` and symbols as text, Map and Set as their
 * entries, Errors as their message, and a circular reference as `[Circular]`.
 */
export const formatState = (value: unknown, indent = 2): string => {
  if (value === undefined) return 'undefined'
  const ancestors: object[] = []
  return JSON.stringify(value, function (this: unknown, key: string, v: unknown) {
    if (typeof v === 'function') return `ƒ ${v.name || 'anonymous'}()`
    if (typeof v === 'undefined') return 'undefined'
    if (typeof v === 'bigint') return `${v}n`
    if (typeof v === 'symbol') return v.toString()
    if (typeof v !== 'object' || v === null) return v
    // `this` is the object holding `key`: pop the ancestors we have left since the last call
    while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) ancestors.pop()
    if (ancestors.includes(v)) return '[Circular]'
    ancestors.push(v)
    if (v instanceof Map) return Object.fromEntries([...v].map(([k, val]) => [String(k), val]))
    if (v instanceof Set) return [...v]
    if (v instanceof Error) return `${v.name}: ${v.message}`
    return v
  }, indent)
}

export const DependencyTracker = {
  stack: [] as string[],
  graph: new Map<string, Set<string>>(),

  enter(name: string) {
    if (isProduction) return;
    this.stack.push(name);
  },

  leave() {
    if (isProduction) return;
    this.stack.pop();
  },

  addDependency(target: string) {
    if (isProduction) return;
    const current = this.stack[this.stack.length - 1];
    if (current && current !== target) {
      if (!this.graph.has(current)) {
        this.graph.set(current, new Set());
      }
      const deps = this.graph.get(current)!;
      if (deps.has(target)) return; // already known edge, cycle already checked
      deps.add(target);

      this.checkCycle(current, target);
    }
  },

  /** Forget a store once its context is evicted so the dev-only graph does not grow forever. */
  remove(name: string) {
    if (isProduction) return;
    this.graph.delete(name);
    for (const deps of this.graph.values()) deps.delete(name);
  },

  checkCycle(start: string, target: string) {
    if (isProduction) return;
    const visited = new Set<string>();
    const queue = [target];

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (node === start) {
        console.warn(`[react-state-custom] Circular dependency detected: ${start} -> ... -> ${node}`);
        return;
      }

      if (visited.has(node)) continue;
      visited.add(node);

      const neighbors = this.graph.get(node);
      if (neighbors) {
        for (const neighbor of neighbors) {
          queue.push(neighbor);
        }
      }
    }
  }
}

/**
 * `Object.is` one level deep: true for the same value, or for two arrays, plain objects, `Map`s or
 * `Set`s of the same kind whose items, keys or values are each `Object.is`-equal. Any other pair of
 * objects (dates, class instances) is equal only when it is the same object. The default `isEqual`
 * of `select`: `useStore(params, { select: s => s.ids })` re-renders only when the array's contents change.
 */
export const shallowEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false
  if (Array.isArray(a)) {
    const other = b as unknown[]
    if (a.length !== other.length) return false
    // an index loop, not every(): every() skips holes, so `new Array(1)` would equal `[42]`.
    // A hole and `undefined` differ too: `map` skips the hole.
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], other[i]) || (a[i] === undefined && (i in a) !== (i in other))) return false
    }
    return true
  }
  if (a instanceof Map) {
    const other = b as Map<unknown, unknown>
    if (a.size !== other.size) return false
    for (const [key, value] of a) if (!other.has(key) || !Object.is(value, other.get(key))) return false
    return true
  }
  if (a instanceof Set) {
    const other = b as Set<unknown>
    if (a.size !== other.size) return false
    for (const item of a) if (!other.has(item)) return false
    return true
  }
  const proto = Object.getPrototypeOf(a)
  if (proto !== Object.prototype && proto !== null) return false
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every(key =>
    Object.prototype.hasOwnProperty.call(b, key) &&
    Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
}
