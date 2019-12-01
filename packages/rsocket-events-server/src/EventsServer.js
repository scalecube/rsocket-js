/**
 * @flow
 */
import {
  newMessage,
  getMessageData,
  updateListeners,
  setLocalAddress,
} from './utils';

import type {IEventListener} from './utils';

import type {ServerOptions} from './RSocketEventsServer';
import type {
  IChannelServer,
  ChannelOptionsServer,
  Connection,
} from './EventsChannelServer';

let listeners: IEventListener[] = [];
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

  _onConnection: Function;
  _clientChannelPort: MessagePort | null;
  debug: boolean;

  constructor(option: ServerOptions) {
    this.eventType = option.eventType || 'RsocketEvents';
    this.address = option.address;
    this.debug = option.debug || false;
    this._getEventData = option.processEvent ||
      (data => data.type === this.eventType ? data.detail : null);

    setLocalAddress(this.address);

    listeners = updateListeners({
      func: this._handler,
      listeners,
      type: this.eventType,
      scope: 'global',
    });
    // $FlowFixMe
    typeof addEventListener === 'function' &&
      addEventListener('message', this._handler.bind(this)); // eslint-disable-line
  }

  _handler(ev) {
    const event = this._getEventData(ev.data);
    if (
      !event ||
      event.address !== this.address ||
      event.type !== 'rsocket-events-open-connection'
    ) {
      return;
    }

    if (ev && (Array.isArray(ev.ports)
      // fix firefox < 52
      || Object.prototype.toString.call(ev.ports) === '[object MessagePortList]')){
      this._clientChannelPort = ev.ports[0];
      this._clientChannelPort.postMessage({type: 'connect'});

      listeners = updateListeners({
        func: connectionHandler,
        listeners,
        type: 'message',
        scope: 'port',
      });

      this._clientChannelPort &&
        this._clientChannelPort.addEventListener('message', ev =>
          connectionHandler(ev, this.onStop.bind(this)));
      this._clientChannelPort && this._clientChannelPort.start();
      this._onConnection(
        new ServerChannel({
          clientChannelPort: this._clientChannelPort || new MessagePort(),
          debug: this.debug,
        }),
      );
    }
  }

  onConnect(cb: Function) {
    this._onConnection = cb;
  }

  onStop() {
    this._clientChannelPort &&
      this._clientChannelPort.postMessage({type: 'disconnect'});
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
  debug: boolean;

  constructor({clientChannelPort, debug}: ChannelOptionsServer) {
    this.clientChannelPort = clientChannelPort;
    this.debug = debug || false;
  }

  connect(): Connection {
    return {
      disconnect: () => {
        this.clientChannelPort.postMessage(
          newMessage({payload: null, type: 'disconnect'}),
        );
        listeners.forEach(
          ({func, type, scope}) =>
            scope === 'port'
              ? this.clientChannelPort.removeEventListener(type, func)
              : // $FlowFixMe
                removeEventListener(type, func),
        );
      },
      receive: cb => {
        listeners = updateListeners({
          func: requestMessage,
          listeners,
          type: 'message',
          scope: 'port',
        });
        this.clientChannelPort.addEventListener('message', eventMsg =>
          requestMessage(eventMsg, cb, this.debug));
      },
      send: msg => {
        if (this.debug) {
          console.log(`Server responses with payload: ${JSON.stringify(msg)}`);
        }
        this.clientChannelPort.postMessage(
          newMessage({
            payload: msg,
            type: 'response',
          }),
        );
      },
    };
  }
}

const requestMessage = (eventMsg, cb, debug) => {
  const {payload, type} = getMessageData(eventMsg);
  if (type === 'request') {
    if (debug) {
      console.log(`Server receive request with payload: ${payload}`);
    }
    cb(payload);
  }
};

const connectionHandler = (ev, onStop) => {
  const event = getMessageData(ev);
  switch (event.type) {
    case 'close': {
      onStop();
    }
  }
};
