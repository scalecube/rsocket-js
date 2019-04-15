/**
 * @flow
 */
import type { Connect, ConnectOptions } from "./Connect";

const eventClient = class Client implements Connect {
  clientChannelPort: any;
  _listeners: Array<any>;

  constructor(options: ConnectOptions) {
    this.clientChannelPort = options.clientChannelPort;
    this._listeners = options._listeners || [];
  }

  connect() {
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
};

export default class EventsServer {
  eventType: string;
  address: string;
  _getEventData: Function;
  _listeners: Array<any>;
  _onConnection: Function;


  constructor(option: { eventType?: string; address: string, processEvent?: (e: any) => any }) {
    this.eventType = option.eventType || "defaultEventsListener";
    this.address = option.address;
    this._getEventData = data => (data.type === this.eventType) ? data.detail : null;

    this._listeners = updateListeners({ listeners: this._listeners, type: this.eventType, func: this._handler });

    window.addEventListener("message", this._handler.bind(this));
  }

  _handler(ev) {
    const event = this._getEventData(ev.data);
    if ( !event || event.address !== this.address || event.type !== "open" ) {
      return;
    }
    const clientChannelPort = ev.ports[0];

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
    this._onConnection(new eventClient({ clientChannelPort: clientChannelPort, _listeners: this._listeners }));
  }

  onConnect(cb: Function) {
    this._onConnection = cb;
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
