/**
 * @flow
 */
import {
  newMessage,
  getMessageData,
  updateListeners
} from 'rsocket-events-client';

import type { IEventListener } from 'rsocket-events-client';

import type { ServerOptions } from './RSocketEventsServer';
import type { IChannelServer, ChannelOptionsServer, Connection } from './EventsChannelServer';


/**
 * EventsServer
 * Waiting for client to initiate connection.
 *
 * successful connection message contain a port message.
 * server will use the port message to return confirmation for the connection.
 */
export default class EventsServer {
  eventType: string;
  address: string;
  _getEventData: Function;
  _listeners: IEventListener[];
  _onConnection: Function;
  _clientChannelPort: MessagePort | null;
  debug: boolean = false;

  constructor(option: ServerOptions) {
    this.eventType = option.eventType || 'defaultEventsListener';
    this.address = option.address;
    this.debug = option.debug;
    this._getEventData = option.processEvent || (data => (data.type === this.eventType) ? data.detail : null);

    this._listeners = updateListeners({
      func: this._handler,
      listeners: this._listeners,
      type: this.eventType
    });
    // $FlowFixMe
    typeof addEventListener === 'function' && addEventListener('message', this._handler.bind(this)); // eslint-disable-line
  }

  _handler(ev) {
    const event = this._getEventData(ev.data);
    if ( !event || event.address !== this.address || event.type !== 'open' ) {
      return;
    }

    if ( ev && Array.isArray(ev.ports) ) {
      this._clientChannelPort = ev.ports[0];
      this._clientChannelPort.postMessage({ type: 'connect' });

      this._listeners = updateListeners({
        func: connectionHandler,
        listeners: this._listeners,
        type: 'message'
      });

      this._clientChannelPort.addEventListener('message', (ev) => connectionHandler(ev, this.onStop.bind(this)));
      this._clientChannelPort.start();
      this._onConnection(new ServerChannel({
        clientChannelPort: this._clientChannelPort || new MessagePort(),
        listeners: this._listeners,
        debug: this.debug
      }));
    }
  }

  onConnect(cb: Function) {
    this._onConnection = cb;
  }

  onStop() {
    this._clientChannelPort && this._clientChannelPort.postMessage({ type: 'disconnect' });
    this._clientChannelPort && this._clientChannelPort.close();
  }
}


/**
 * ServerChannel implements IChannelServer
 *
 * server connection implementation
 */
class ServerChannel implements IChannelServer {
  clientChannelPort: MessagePort;
  _listeners: IEventListener[];
  debug: boolean;

  constructor({ clientChannelPort, listeners, debug }: ChannelOptionsServer) {
    this.clientChannelPort = clientChannelPort;
    this._listeners = listeners || [];
    this.debug = debug || false;
  }

  connect(): Connection {
    return {
      disconnect: () => {
        this.clientChannelPort.postMessage(newMessage({ payload: null, type: 'disconnect' }));
        this._listeners.forEach(({ func, type }) => this.clientChannelPort.removeEventListener(type, func));
      },
      receive: cb => {

        this._listeners = updateListeners({
          func: requestMessage,
          listeners: this._listeners,
          type: 'message'
        });
        this.clientChannelPort.addEventListener('message', (eventMsg) => requestMessage(eventMsg, cb, this.debug));
      },
      send: msg => {
        if ( this.debug ) {
          console.log(`Server responses with payload: ${ JSON.stringify(msg) }`);
        }
        this.clientChannelPort.postMessage(newMessage({
          payload: msg,
          type: 'response'
        }));
      }
    };
  }
}

const requestMessage = (eventMsg, cb, debug) => {
  const { payload, type } = getMessageData(eventMsg);
  if ( type === 'request' ) {
    if ( debug ) {
      console.log(`Server receive request with payload: ${ payload }`);
    }
    cb(payload);
  }
};

const connectionHandler = (ev, onStop) => {
  const event = getMessageData(ev);
  switch ( event.type ) {
    case 'close': {
      onStop();
    }
  }
};
