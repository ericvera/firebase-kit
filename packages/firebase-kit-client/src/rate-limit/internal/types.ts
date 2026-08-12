/** One key's calls inside the current window, newest last. */
export interface CallRecord {
  /** Epoch milliseconds of each call still inside the window. */
  timestamps: number[]
}
