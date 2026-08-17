type GetValueFunction<T> = (i: T) => number | string

export const ascCompare =
  <T>(getValue: GetValueFunction<T>) =>
  (a: T, b: T): number => {
    const av = getValue(a)
    const bv = getValue(b)

    if (typeof av === 'number' && typeof bv === 'number') {
      return av - bv
    } else if (typeof av === 'string' && typeof bv === 'string') {
      return av.localeCompare(bv)
    }

    throw new Error('Trying to compare values that are not string or number')
  }
