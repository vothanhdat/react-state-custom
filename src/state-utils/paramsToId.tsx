
export const paramsToId = (params: any) => Object
  .keys(params ?? {})
  .toSorted()
  .map(key => key + '=' + params?.[key])
  .join("&");
