/**
 * @flow
 */

import type { Connect, Connection, ConnectOptions } from "./Connect";

const thread = window || global;

export default class EventsClient implements Connect {
  eventType: string;

  constructor(option: ConnectOptions) {
    this.eventType = option.eventType || "defaultEventsListener";
  }

  connect(address: string): Connection {
    let channel: any = new MessageChannel();
    let listeners = [];

    typeof thread.postMessage === "function" && thread.postMessage(
      new CustomEvent(this.eventType, {
        address,
        type: "open"
      }), [channel.port2]);

    const initConnection = (msg: { type: string; payload: any }) => {
      switch ( msg.type ) {
        case "connect": {
          console.log("connect-client", msg.payload);
          break;
        }
        case "disconnect": {
          if ( channel ) {
            console.log("disconnect-client", msg.payload);
            channel.port1.close();
            Array.isArray(listeners) && listeners.forEach(({ type, func }) => channel.port1.removeEventListener(type, func));
            channel = null;
          }
          break;
        }
      }
    };

    listeners = updateListeners({ listeners, type: "message", func: initConnection });
    channel.port1.addEventListener("message", initConnection);

    return Object.freeze({
      send: (msg) => {
        console.log("send-client", msg);
        channel.port1.postMessage(newMessage({ type: "request", payload: msg }));
      },
      receive: (cb) => {

        const responseMessage = (e) => {
          if ( e.type === "response" ) {
            console.log("response-client", e.payload);
            cb(e.payload);
          }
        };

        listeners = updateListeners({ listeners, type: "message", func: responseMessage });
        channel.port1.addEventListener("message", responseMessage);
      },
      disconnect: () => {
        channel.port1.postMessage(newMessage({ type: "close", payload: null }));
      }
    });
  }
}

const newMessage = ({ type, payload }) => ({
  type,
  cid: Date.now() + "-" + Math.random(),
  payload
});

const updateListeners = ({ listeners = [], type, func }) => (type && func &&  Array.isArray(listeners)) ? listeners.push({ type, func }) : listeners;
