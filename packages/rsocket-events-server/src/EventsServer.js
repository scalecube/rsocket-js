/**
 * @flow
 */
import {
  newMessage,
  getMessageData,
  updateListeners
} from "rsocket-events-client";

import type { IEventListener } from "rsocket-events-client";

import type { ServerOptions } from "./RSocketEventsServer";
import type { IChannelServer, ChannelOptionsServer, Connection } from "./EventsChannelServer";

export default class EventsServer {
  eventType: string;
  address: string;
  _getEventData: Function;
  _listeners: IEventListener[];
  _onConnection: Function;

  constructor(option: ServerOptions) {
    this.eventType = option.eventType || "defaultEventsListener";
    this.address = option.address;
    this._getEventData = option.processEvent || (data => (data.type === this.eventType) ? data.detail : null);

    this._listeners = updateListeners({ listeners: this._listeners, type: this.eventType, func: this._handler });
    // $FlowFixMe
    typeof addEventListener === "function" && addEventListener("message", this._handler.bind(this));
  }

  _handler(ev) {
    const event = this._getEventData(ev.data);
    if ( !event || event.address !== this.address || event.type !== "open" ) {
      return;
    }

    const clientChannelPort = ev && Array.isArray(ev.ports) ? ev.ports[0] : null;

    if ( !clientChannelPort ) {
      return;
    }

    clientChannelPort.postMessage({ type: "connect" });

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
    this._onConnection(new EventsClient({ clientChannelPort: clientChannelPort, _listeners: this._listeners }));
  }

  onConnect(cb: Function) {
    this._onConnection = cb;
  }
}

class EventsClient implements IChannelServer {
  clientChannelPort: any;
  _listeners: IEventListener[];

  constructor(options: ChannelOptionsServer) {
    this.clientChannelPort = options.clientChannelPort;
    this._listeners = options._listeners || [];
  }

  connect(): Connection {
    return {
      send: (msg) => {
        this.clientChannelPort.postMessage(newMessage({ type: "response", payload: msg }));
      },
      receive: (cb) => {
        const requestMessage = (eventMsg) => {
          const { type, payload } = getMessageData(eventMsg);
          if ( type === "request" ) {
            console.log("receive-request", payload);
            cb(payload);
          }
        };
        this._listeners = updateListeners({ listeners: this._listeners, type: "message", func: requestMessage });
        this.clientChannelPort.addEventListener("message", requestMessage);
      },
      disconnect: () => {
        this.clientChannelPort.postMessage(newMessage({ type: "disconnect", payload: null }));
        this._listeners.forEach(({ type, func }) => this.clientChannelPort.removeEventListener(type, func));
      }
    };
  }
}


