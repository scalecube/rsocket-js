/**
 * @flow
 */
import {
  newMessage,
  getMessageData,
  updateListeners,
} from 'rsocket-events-client';

import type {IEventListener} from 'rsocket-events-client';

import type {ServerOptions} from './RSocketEventsServer';
import type {IChannelServer, ChannelOptionsServer, Connection} from './EventsChannelServer';

export default class EventsServer {
  eventType: string;
  address: string;
  _getEventData: Function;
  _listeners: IEventListener[];
  _onConnection: Function;
  _clientChannelPort: MessagePort | null;

  constructor(option: ServerOptions) {
    this.eventType = option.eventType || 'defaultEventsListener';
    this.address = option.address;
    this._getEventData = option.processEvent || (data => (data.type === this.eventType) ? data.detail : null);

    this._listeners = updateListeners({
      func: this._handler,
      listeners: this._listeners,
      type: this.eventType,
    });
    // $FlowFixMe
    typeof addEventListener === 'function' && addEventListener('message', this._handler.bind(this)); // eslint-disable-line
  }

  _handler(ev) {
    const event = this._getEventData(ev.data);
    if (!event || event.address !== this.address || event.type !== 'open') {
      return;
    }

    if (ev && Array.isArray(ev.ports)) {
      this._clientChannelPort = ev.ports[0];
    } else {
      return;
    }

    this._clientChannelPort.postMessage({type: 'connect'});

    const connectionHandler = ev => {
      const event = getMessageData(ev);
      switch (event.type) {
        case 'close': {
          this.onStop();
        }
      }
    };

    this._listeners = updateListeners({
      func: connectionHandler,
      listeners: this._listeners,
      type: 'message',
    });
    this._clientChannelPort.addEventListener('message', connectionHandler);
    this._clientChannelPort.start();
    this._onConnection(new EventsClient({clientChannelPort: this._clientChannelPort, listeners: this._listeners}));
  }

  onConnect(cb: Function) {
    this._onConnection = cb;
  }

  onStop() {
    this._clientChannelPort.postMessage({type: 'disconnect'});
    this._clientChannelPort.close();
  }
}

class EventsClient implements IChannelServer {
  clientChannelPort: any;
  _listeners: IEventListener[];

  constructor(options: ChannelOptionsServer) {
    this.clientChannelPort = options.clientChannelPort;
    this._listeners = options.listeners || [];
  }

  connect(): Connection {
    return {
      disconnect: () => {
        this.clientChannelPort.postMessage(newMessage({payload: null, type: 'disconnect'}));
        this._listeners.forEach(({func, type}) => this.clientChannelPort.removeEventListener(type, func));
      },
      receive: cb => {
        const requestMessage = eventMsg => {
          const {payload, type} = getMessageData(eventMsg);
          if (type === 'request') {
            cb(payload);
          }
        };
        this._listeners = updateListeners({
          func: requestMessage,
          listeners: this._listeners,
          type: 'message',
        });
        this.clientChannelPort.addEventListener('message', requestMessage);
      },
      send: msg => {
        this.clientChannelPort.postMessage(newMessage({
          payload: msg,
          type: 'response',
        }));
      },
    };
  }
}


