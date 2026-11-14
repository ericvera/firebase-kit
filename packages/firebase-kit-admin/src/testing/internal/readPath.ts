import { isMap } from './isMap.js'

export const readPath = (
  data: Record<string, unknown>,
  path: string,
): unknown => {
  const [first = '', ...rest] = path.split('.')
  let value = data[first]

  for (const segment of rest) {
    if (!isMap(value)) {
      return undefined
    }

    value = value[segment]
  }

  return value
}
