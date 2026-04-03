// String-based synchronous event bus.
// ONLY AudioSystem and UI subscribe here.
// All other cross-system calls go through GameController directly.

const listeners = {}

const EventBus = {
  on(event, fn) {
    if (!listeners[event]) listeners[event] = []
    listeners[event].push(fn)
  },

  off(event, fn) {
    if (!listeners[event]) return
    listeners[event] = listeners[event].filter(f => f !== fn)
  },

  emit(event, data) {
    if (!listeners[event]) return
    for (const fn of listeners[event]) fn(data)
  },
}

export default EventBus
