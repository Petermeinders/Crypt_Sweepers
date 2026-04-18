import { CONFIG } from '../config.js'

// Single logging wrapper — all modules use this, never console directly.
// Format: [ModuleName] message
// Debug logs only fire when CONFIG.debug = true.

const Logger = {
  error(msg, ...args) {
    console.error(msg, ...args)
  },
  warn(msg, ...args) {
    console.warn(msg, ...args)
  },
  info(msg, ...args) {
    console.info(msg, ...args)
  },
  debug(msg, ...args) {
    if (CONFIG.debug) console.log(msg, ...args)
  },
}

export default Logger
