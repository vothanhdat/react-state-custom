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

