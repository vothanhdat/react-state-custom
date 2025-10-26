import { useRef } from "react"


const randomHash = () => Math.random().toString().slice(2)

/**
 * useArrayChangeId
 *
 * A custom hook that generates a stable change identifier for an array of values.
 * The identifier changes only when the array's contents differ from the previous call.
 *
 * @param e - The input array to track.
 * @returns A string identifier that updates when the array changes.
 *
 * How it works:
 * - Tracks the previous array and its identifier using a `useRef`.
 * - Compares the new array to the previous one by length and element equality (shallow comparison).
 * - If any difference is detected, generates a new random identifier.
 * 
 * Note: Uses shallow comparison - compares array length and element references using `!=`.
 * For objects and nested arrays, only references are compared, not deep values.
 */
export const useArrayChangeId = (e: any[]): string => {
  const ref = useRef<{ values: any[]; id: string }>({
    values: [],
    id: randomHash()
  })

  // Check for differences in array existence, length, or elements
  let isDiff = false
  isDiff = isDiff || ((!e) != (!ref.current.values))
  isDiff = isDiff || (e?.length != ref.current.values?.length)
  isDiff = isDiff || (e?.some((f, i) => f != ref.current.values[i]))

  // Update the identifier if differences are found
  if (isDiff) {
    ref.current.values = e
    ref.current.id = randomHash()
  }

  return ref.current.id
}