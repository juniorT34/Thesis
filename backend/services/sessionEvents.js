import EventEmitter from "events";

const sessionEvents = new EventEmitter();
sessionEvents.setMaxListeners(0);

export const emitSessionEvent = (payload = {}) => {
  const event = {
    timestamp: new Date().toISOString(),
    ...payload,
  };
  sessionEvents.emit("session-event", event);
  return event;
};

export const registerSessionListener = (handler) => {
  sessionEvents.on("session-event", handler);
  return () => sessionEvents.off("session-event", handler);
};










