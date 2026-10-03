
/** A value store identity can serialize. */
export type ParamValue = string | number | bigint | boolean | null | undefined
export type ParamsToIdRecord = Record<string, ParamValue>
export type ParamsToIdInput = ParamsToIdRecord | undefined
/**
 * The constraint on a store's params: an object type whose values are all `ParamValue`s. Written
 * over `keyof U` so that interfaces qualify; `Record<string, ...>` would need an index signature.
 */
export type StoreParamsShape<U> = { [K in keyof U]: ParamValue }

/** A string that would print the same as a number, bigint, boolean or null. */
const looksLikeLiteral = (s: string) =>
  s === "true" || s === "false" || s === "null" || /^-?\d+n?$/.test(s) || String(Number(s)) === s

const encodeValue = (value: string | number | bigint | boolean | null) => {
  if (typeof value === "bigint") return value + "n"
  if (typeof value !== "string") return String(value)
  // `'` is left alone by encodeURIComponent; escape it so a raw `'` always means "quoted"
  const encoded = encodeURIComponent(value).replace(/'/g, "%27")
  return looksLikeLiteral(encoded) ? "'" + encoded + "'" : encoded
}

/**
 * Converts a parameters object into a deterministic string identifier.
 * 
 * This function creates a consistent string representation of parameters by:
 * - Sorting keys alphabetically to ensure deterministic output
 * - Skipping keys whose value is `undefined`, so `{ id, page: undefined }` and `{ id }` are one instance
 * - Validating that all values are primitive types
 * - URI-encoding keys and values so that `=`, `&` and `?` inside a value can never
 *   collide with the separators (`{ a: "1&b=2" }` and `{ a: "1", b: "2" }` stay distinct)
 * - Keeping types apart: a string that reads like a number, bigint, boolean or null is quoted
 *   (`{ id: "1" }` -> `id='1'`, `{ id: 1 }` -> `id=1`), and a bigint ends in `n`
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
 * paramsToId({ id: "42" })               // Returns "id='42'"
 * paramsToId({ q: "a&b", page: undefined }) // Returns "q=a%26b"
 * paramsToId() // Returns ""
 * ```
 */
export const paramsToId = (params: ParamsToIdInput = undefined) => Object
  .keys(params ?? {})
  .filter(key => params?.[key] !== undefined)
  .sort()
  .map(key => {
    const value = params![key] as string | number | bigint | boolean | null | object;
    if (
      value !== null &&
      (typeof value === "object" || typeof value === "function")
    ) {
      throw new Error(`Parameter "${key}" must be a primitive value (string, number, bigint, boolean, null, or undefined), but received ${typeof value}`)
    }
    return encodeURIComponent(key) + '=' + encodeValue(value)
  })
  .join("&");
