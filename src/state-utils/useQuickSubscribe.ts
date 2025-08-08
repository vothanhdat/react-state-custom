
import { debounce } from "lodash-es";
import { useState, useMemo, useEffect } from "react";
import type { Context } from "./ctx";

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

  const [, setCounter] = useState(0);

  const { proxy, finalGetter, openGetter, clean } = useMemo(
    () => {

      const allKeys = new Set<keyof D>()
      const allCompareValue: { [P in keyof D]?: D[P] | undefined; } = {}
      const allUnsub = new Map()

      const proxy = new Proxy(
        ctx?.data as any,
        {
          get(target, p) {
            if (isOpenGetter) {
              allKeys.add(p as keyof D)
              return allCompareValue[p as keyof D] = target[p];
            } else {
              throw new Error("now allow here")
            }
          }
        }
      ) as any

      let isOpenGetter = true;


      let onChange = debounce(() => {
        if ([...allKeys.values()]
          .some(k => allCompareValue[k] != ctx?.data?.[k])) {
          setCounter(c => c + 1)
        }
      }, 0)

      let openGetter = () => {
        isOpenGetter = true
        allKeys.clear()
      }

      let finalGetter = () => {
        isOpenGetter = false;

        [...allKeys.values()]
          .filter(k => !allUnsub.has(k))
          .forEach(k => {
            allUnsub.set(k, ctx?.subscribe(k, onChange))
          });

        [...allUnsub.keys()]
          .filter(k => !allKeys.has(k))
          .forEach(k => {
            let unsub = allUnsub.get(k)
            unsub?.();
            allUnsub.delete(k);
          });

      }

      let clean = () => {
        openGetter();
        finalGetter();
        setCounter(c => c + 1)
      }

      return { proxy, finalGetter, openGetter, clean }
    },
    [ctx]
  )

  openGetter();

  setTimeout(finalGetter, 0)

  useEffect(
    () => () => clean(),
    [clean]
  )

  return proxy;


};
