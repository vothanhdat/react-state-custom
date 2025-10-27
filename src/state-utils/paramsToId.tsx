


/**
 * Converts a parameters object into a deterministic string identifier.
 * 
 * This function creates a consistent string representation of parameters by:
 * - Sorting keys alphabetically to ensure deterministic output
 * - Validating that all values are primitive types
 * - Joining key-value pairs with '&' separator
 * 
 * @param params - Object containing string, number, bigint, boolean, null, or undefined values.
 *                 Defaults to undefined if not provided.
 * @returns A string identifier in the format "key1=value1&key2=value2"
 * 
 * @throws {Error} When any parameter value is an object (non-primitive type)
 * 
 * @example
 * ```typescript
 * paramsToId({ name: "john", age: 30 }) // Returns "age=30&name=john"
 * paramsToId({ id: null, active: true }) // Returns "active=true&id=null"
 * paramsToId() // Returns ""
 * ```
 */
export const paramsToId = (params: Record<string, string | number | bigint | boolean | null | undefined> | undefined = undefined) => Object
  .keys(params ?? {})
  .sort()
  .map(key => {
    const value = params?.[key];
    if (
      value !== null &&
      (typeof value === "object" || typeof value === "function")
    ) {
      throw new Error(`Parameter "${key}" must be a primitive value (string, number, bigint, null, or undefined), but received ${typeof value}`)
    }
    return key + '=' + value
  })
  .join("&");
