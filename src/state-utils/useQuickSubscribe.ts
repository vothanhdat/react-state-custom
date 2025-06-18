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

import { debounce } from "lodash-es";
import { useState, useMemo, useEffect } from "react";
import type { Context } from "./ctx";


export const useQuickSubscribe = <D>(
  ctx: Context<D> | undefined
): {
    [P in keyof D]?: D[P] | undefined;
  } => {

  const [, setCounter] = useState(0);

  const { proxy, clean, handleOnChange } = useMemo(
    () => {

      const allKeys = new Set<keyof D>()
      const allUnsubInstance = new Map<keyof D, Function>()
      const allCompareValue = ({} as Partial<D>)

      const handleOnChange = debounce(() => {
        console.log("handleOnChange",allCompareValue)
        if (ctx && Object
          .keys(allCompareValue)
          .some((i: any) => allCompareValue[i as keyof D] != ctx?.data[i as keyof D])) {
          setCounter(c => c + 1);
        }
      }, 1)

      const handleChangeKey = debounce(() => {
        if (ctx) {
          console.log("handleChangeKey")
          let shouldUpdate = false;
          let keyToDelete: (keyof D)[] = []

          for (let [k, unsub] of allUnsubInstance) {
            if (!allKeys.has(k)) {
              console.log("Remove", k)
              unsub?.();
              keyToDelete.push(k)
            }
          }
          keyToDelete.forEach(k => {
            allUnsubInstance.delete(k);
            delete allCompareValue[k];
          })
          for (let k of allKeys) {
            if (!allUnsubInstance.has(k)) {
              console.log("Add   ", k)
              const sub = ctx.subscribe(k, handleOnChange);
              allUnsubInstance.set(k, sub);
              shouldUpdate = true;
            }
          }
          allKeys.clear()
          if (shouldUpdate) handleOnChange?.();
        }
      }, 0)

      const handleAddKey = (p: keyof D) => {
        allKeys.add(p);
        handleChangeKey();
      }

      const proxy = new Proxy(
        ctx?.data as any,
        {
          get(target, p) {
            handleAddKey(p as keyof D);
            console.log({ [p]: target[p] });
            return allCompareValue[p as keyof D] = target[p];
          }
        }
      ) as any

      const clean = () => {
        console.log("Clean", allKeys)
        handleChangeKey?.()
      }

      console.log("NEW")
      return { proxy, clean, handleOnChange }
    },
    [ctx]
  )

  useEffect(() => () => clean?.(), [clean])

  // useEffect(() => {
  //   let i = setInterval(handleOnChange, 5000);
  //   return () => clearInterval(i);
  // },[handleOnChange])

  return proxy;


};
