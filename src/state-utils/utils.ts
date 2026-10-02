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

export type Memoized<T extends (...args: any[]) => any> = ((...args: Parameters<T>) => ReturnType<T>) & {
  cache: Map<string, ReturnType<T>>,
  /** Return the cached result for these args without creating one. */
  fromCache: (...args: Parameters<T>) => ReturnType<T> | undefined,
  /** The cache key used for these args. */
  keyFor: (...args: Parameters<T>) => string,
}

// Memoize function
export function memoize<T extends (...args: any[]) => any>(func: T): Memoized<T> {

  const cache = new Map<string, ReturnType<T>>();
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

declare var process: any;

/**
 * True when running a production build.
 * Bundlers statically replace `process.env.NODE_ENV`; when nothing replaces it and no
 * `process` global exists (plain browser ESM), the access throws and we fall back to dev mode
 * instead of crashing the whole module.
 */
export const isProduction: boolean = (() => {
  try {
    return process.env.NODE_ENV === 'production';
  } catch {
    return false;
  }
})();

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
