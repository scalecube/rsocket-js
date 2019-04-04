/**
 * @flow
 */
import type { Connect } from "./Connect";
const thread = window || global;

export default class EventsServer {
  constructor(option: { eventType?: string; address: string, processEvent: (e: any) => any }) {
    this.eventType = option.eventType || "defaultEventsListener";
    this.address = option.address;
    this._getEventData = option.processEvent || (e => e.details);

    this._handler = this._handler.bind(this);
    this._listeners = updateListeners({ type: this.eventType, func: this._handler });
    typeof thread.addEventListener === "function" && thread.addEventListener(this.eventType, this._handler);
  }

  _handler(e) {
    const event = this._getEventData(e);
    if ( event.address !== this.address && event.type === "open" ) {
      return;
    }
    const clientChannelPort = e.ports[0];

    clientChannelPort.postMessage({ type: "connect" });
    const eventClient: Connect = {
      connect: () => {
        return {
          send: (msg) => {
            clientChannelPort.postMessage(newMessage({ type: "response", payload: msg }));
          },
          receive: (cb) => {
            const requestMessage = (e) => {
              if ( e.type === "request" ) {
                console.log("request-server", e.payload);
                cb(e.payload);
              }
            };
            this._listeners = updateListeners({ listeners: this._listeners, type: "message", func: requestMessage });
            clientChannelPort.addEventListener("message", requestMessage);
          },
          disconnect: () => {
            clientChannelPort.postMessage(newMessage({ type: "disconnect", payload: null }));
            this._listeners.forEach(({ type, func }) => clientChannelPort.removeEventListener(type, func));
          }
        };
      }
    };

    const connectionHandler = (msg) => {
      switch ( msg.type ) {
        case "close": {
          clientChannelPort.postMessage({ type: "disconnect" });
          clientChannelPort.close();
        }
      }
    };

    this._listeners = updateListeners({ listeners: this._listeners, type: "message", func: connectionHandler });
    clientChannelPort.addEventListener("message", connectionHandler);
    clientChannelPort.start();
    this._onConnection(eventClient);
  }

  onConnect(cb) {
    this._onConnection = cb;
  }
}


const newMessage = ({ type, payload }) => ({
  type,
  cid: Date.now() + "-" + Math.random(),
  payload
});

const updateListeners = ({ listeners = [], type, func }) => (type && func) ? listeners.push({ type, func }) : listeners;
