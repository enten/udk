function decorateEventListener (name, emitter, decorator) {
  const emitterEvents = emitter && emitter._events
  const eventListener = emitterEvents && emitterEvents[name]

  if (eventListener && decorator) {
    emitter._events[name] = decorator(eventListener)
  }
}

module.exports = decorateEventListener