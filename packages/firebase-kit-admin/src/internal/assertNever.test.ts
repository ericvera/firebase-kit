import { expect, it, vi } from 'vitest'
import { assertNever } from './assertNever.js'

it('returns undefined when called', () => {
  // In practice, this should never be reached if all cases are handled
  // But at runtime, it safely returns undefined
  // Called through a spy so the returned value is read from the call record
  // rather than out of the call expression — a void-typed call is not a value
  // an expression may consume.
  const spy = vi.fn(assertNever)

  spy({} as never)

  expect(spy).toHaveReturnedWith(undefined)
})

it('can be used in exhaustive switch statement', () => {
  type Color = 'red' | 'blue' | 'green'

  const getColorName = (color: Color): string => {
    switch (color) {
      case 'red':
        return 'Red'
      case 'blue':
        return 'Blue'
      case 'green':
        return 'Green'
      default:
        // TypeScript accepts this because all cases are handled
        assertNever(color)
        return 'Unknown'
    }
  }

  expect(getColorName('red')).toMatchInlineSnapshot(`"Red"`)
  expect(getColorName('blue')).toMatchInlineSnapshot(`"Blue"`)
  expect(getColorName('green')).toMatchInlineSnapshot(`"Green"`)
})

it('can be used in exhaustive if-else statement', () => {
  type Status = 'pending' | 'active' | 'completed'

  // The last branch tests through a type guard rather than a literal
  // comparison: by then the compiler has narrowed `status` down to
  // 'completed', so comparing it against that literal again would be
  // statically redundant, while the guard still leaves the final else a never.
  const isCompleted = (value: Status): value is 'completed' =>
    value === 'completed'

  const getStatusMessage = (status: Status): string => {
    if (status === 'pending') {
      return 'Pending'
    } else if (status === 'active') {
      return 'Active'
    } else if (isCompleted(status)) {
      return 'Completed'
    } else {
      // TypeScript accepts this because all cases are handled
      assertNever(status)
      return 'Unknown'
    }
  }

  expect(getStatusMessage('pending')).toMatchInlineSnapshot(`"Pending"`)
  expect(getStatusMessage('active')).toMatchInlineSnapshot(`"Active"`)
  expect(getStatusMessage('completed')).toMatchInlineSnapshot(`"Completed"`)
})

it('produces TypeScript error when not all cases are handled', () => {
  type Priority = 'low' | 'medium' | 'high' | 'urgent'

  const getPriorityLevel = (priority: Priority): number => {
    switch (priority) {
      case 'low':
        return 1
      case 'medium':
        return 2
      case 'high':
        return 3
      // Missing 'urgent' case - TypeScript will error on assertNever
      default:
        // @ts-expect-error - Intentionally missing 'urgent' case
        assertNever(priority)
        return 0
    }
  }

  expect(getPriorityLevel('low')).toMatchInlineSnapshot(`1`)
  expect(getPriorityLevel('medium')).toMatchInlineSnapshot(`2`)
  expect(getPriorityLevel('high')).toMatchInlineSnapshot(`3`)
  // In runtime, if 'urgent' is passed, it falls through to default
  expect(getPriorityLevel('urgent')).toMatchInlineSnapshot(`0`)
})
