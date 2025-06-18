
import { debounce } from "lodash-es";
import { useState, useMemo, useEffect } from "react";
import type { Context } from "./ctx";


export const useQuickSubscribeV2 = <D>(
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
    []
  )

  openGetter();

  setTimeout(finalGetter, 0)

  useEffect(
    () => () => clean(),
    [clean]
  )

  return proxy;


};
