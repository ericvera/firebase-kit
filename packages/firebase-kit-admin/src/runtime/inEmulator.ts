import { RuntimeContext } from './constants.js'
import { getRuntimeContext } from './getRuntimeContext.js'

export const inEmulator = () => getRuntimeContext() === RuntimeContext.Emulator
