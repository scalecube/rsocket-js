/**
 * @flow
 */

import type { Connect, Connection, ConnectOptions } from "./Connect";

export default class EventsClient implements Connect {
  eventType: string;
  confirmConnectionOpenCallback: Function;

  constructor(option: ConnectOptions) {
    this.eventType = option.eventType || "defaultEventsListener";
    this.confirmConnectionOpenCallback = option.confirmConnectionOpenCallback;
  }

  connect(address: string): Connection {

    let channel: any = new MessageChannel();
    let listeners = [];

    window.postMessage({
      type: this.eventType,
      detail: {
        address,
        type: "open"
      }
    }, "*", [channel.port2]);

    const initConnection = (eventMsg) => {
      const { type } = getMessageData(eventMsg);
      switch ( type ) {
        case "connect": {
          console.log("connect-client");
          typeof this.confirmConnectionOpenCallback === "function" && this.confirmConnectionOpenCallback();
          break;
        }
        case "disconnect": {
          if ( channel ) {
            console.log("disconnect-client");
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
    channel.port1.start();

    return Object.freeze({
      send: (msg) => {
        console.log("request", msg);
        channel.port1.postMessage(newMessage({ type: "request", payload: msg }));
      },
      receive: (cb) => {

        const responseMessage = (eventMsg) => {
          const { type, payload } = getMessageData(eventMsg);
          if ( type === "response" ) {
            console.log("response", payload);
            cb(payload);
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

const getMessageData = (eventMsg) => eventMsg ? eventMsg.data : null;

const updateListeners = ({ listeners = [], type, func }: { listeners: Array<any>, type: string, func: Function }) => (type && func) ? [...listeners, {
  type,
  func
}] : [...listeners];
