// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) & { cancel: any } {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  let fn: Function & { cancel: any } = function (...args: Parameters<T>): void {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  } as any;

  fn.cancel = () => clearTimeout(timeout!);

  return fn as any;
}

// Memoize function
export function memoize<T extends (...args: any[]) => any>(
  func: T
): ((...args: Parameters<T>) => ReturnType<T>) & { cache: Map<string, ReturnType<T>> } {
  
  const cache = new Map<string, ReturnType<T>>();

  const cachedFunc: any = function (...args: Parameters<T>): ReturnType<T> {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key) as ReturnType<T>;
    }
    const result = func(...args);
    cache.set(key, result);
    return result;
  }

  cachedFunc.cache = cache;

  return cachedFunc
}

declare var process: any;

export const DependencyTracker = {
  stack: [] as string[],
  graph: new Map<string, Set<string>>(),

  enter(name: string) {
    if (process.env.NODE_ENV === 'production') return;
    this.stack.push(name);
  },

  leave() {
    if (process.env.NODE_ENV === 'production') return;
    this.stack.pop();
  },

  addDependency(target: string) {
    if (process.env.NODE_ENV === 'production') return;
    const current = this.stack[this.stack.length - 1];
    if (current && current !== target) {
      if (!this.graph.has(current)) {
        this.graph.set(current, new Set());
      }
      this.graph.get(current)!.add(target);

      this.checkCycle(current, target);
    }
  },

  checkCycle(start: string, target: string) {
    if (process.env.NODE_ENV === 'production') return;
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

