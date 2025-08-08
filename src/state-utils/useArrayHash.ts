import { useRef } from "react"


const randomHash = () => Math.random().toString().slice(2)

/**
 * useArrayHash
 *
 * A custom hook that computes a stable hash for an array of values.
 * The hash changes only when the array's contents differ from the previous call.
 *
 * @param e - The input array to hash.
 * @returns A string hash that updates when the array changes.
 *
 * How it works:
 * - Tracks the previous array and its hash using a `useRef`.
 * - Compares the new array to the previous one by length and element equality.
 * - If any difference is detected, generates a new random hash.
 */
export const useArrayHash = (e: any[]): string => {

  const { current: { computedHash } } = useRef({
    /**
     * Getter for the computed hash function.
     *
     * - Initializes with an empty array and a random hash.
     * - Returns a function that compares the current array to the previous one.
     * - Updates the hash if any difference is detected.
     */
    get computedHash() {
      let currentValues: any[] = []
      let currentHash = randomHash()
      return (e: any[]) => {
        let isDiff = false

        // Check for differences in array existence, length, or elements.
        isDiff = isDiff || ((!e) != (!currentValues))
        isDiff = isDiff || (e?.length != currentValues?.length);
        isDiff = isDiff || (e.some((f, i) => f != currentValues[i]));

        // Update the hash if differences are found.
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