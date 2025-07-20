import { useRef } from "react"


const randomHash = () => Math.random().toString().slice(2)

export const useObjHash = (e: any[]): string => {

  const { current: { computedHash } } = useRef({
    get computedHash() {
      let currentValues: any[] = []
      let currentHash = randomHash()
      return (e: any[]) => {
        let isDiff = false

        isDiff = isDiff || ((!e) != (!currentValues))
        isDiff = isDiff || (e?.length != currentValues?.length);
        isDiff = isDiff || (e.some((f, i) => f != currentValues[i]));

        currentValues = e;
        if (isDiff) {
          currentHash = randomHash()
        }

        return currentHash
      }
    }
  })

  return computedHash(e)
}