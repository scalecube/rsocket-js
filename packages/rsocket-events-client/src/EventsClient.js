/**
 * @flow env=browser,webworker,webworker
 */


import { getMessageData, newMessage, updateListeners } from "./utils";
import type { IEventListener } from "./utils";
import type { IChannelClient, ChannelOptionsClient, Connection } from "./EventsChannelClient";

export default class EventsClient implements IChannelClient {
  eventType: string;
  confirmConnectionOpenCallback: Function | void;

  constructor(option: ChannelOptionsClient) {
    this.eventType = option.eventType || "defaultEventsListener";
    this.confirmConnectionOpenCallback = option.confirmConnectionOpenCallback;
  }

  connect(address: string): Connection {

    let channel: any = new MessageChannel();
    let listeners: IEventListener[];
    // $FlowFixMe
    typeof postMessage === "function" && postMessage({
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

    listeners = updateListeners({ type: "message", func: initConnection });
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

