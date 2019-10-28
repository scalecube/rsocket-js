import { Flowable } from 'rsocket-flowable';
import RSocketEventsClient from 'rsocket-events-client';

/**
 *
 *      
 */
const newMessage = ({
  type,
  payload
}) => ({
  cid: Date.now() + '-' + Math.random(),
  payload,
  type
}); // $FlowFixMe

const getMessageData = ({
  data
}) => data || null;
const updateListeners = ({
  listeners = [],
  type,
  func,
  scope
}) => type && func ? [...listeners, {
  func,
  type,
  scope
}] : [...listeners];
let localAddress = [];
const setLocalAddress = address => {
  localAddress = [...localAddress, address];
  return localAddress;
};

/**
 *      
 */
let listeners = [];
/**
 * EventsServer
 * Waiting for client to initiate connection.
 *
 * successful connection message contain a port message.
 * server will use the port message to return confirmation for the connection.
 */

class EventsServer {
  constructor(option) {
    this.eventType = option.eventType || 'RsocketEvents';
    this.address = option.address;
    this.debug = option.debug || false;

    this._getEventData = option.processEvent || (data => data.type === this.eventType ? data.detail : null);

    setLocalAddress(this.address);
    listeners = updateListeners({
      func: this._handler,
      listeners,
      type: this.eventType,
      scope: 'global'
    }); // $FlowFixMe

    typeof addEventListener === 'function' && addEventListener('message', this._handler.bind(this)); // eslint-disable-line
  }

  _handler(ev) {
    const event = this._getEventData(ev.data);

    if (!event || event.address !== this.address || event.type !== 'rsocket-events-open-connection') {
      return;
    }

    if (ev && Array.isArray(ev.ports)) {
      this._clientChannelPort = ev.ports[0];

      this._clientChannelPort.postMessage({
        type: 'connect'
      });

      listeners = updateListeners({
        func: connectionHandler,
        listeners,
        type: 'message',
        scope: 'port'
      });
      this._clientChannelPort && this._clientChannelPort.addEventListener('message', ev => connectionHandler(ev, this.onStop.bind(this)));
      this._clientChannelPort && this._clientChannelPort.start();

      this._onConnection(new ServerChannel({
        clientChannelPort: this._clientChannelPort || new MessagePort(),
        debug: this.debug
      }));
    }
  }

  onConnect(cb) {
    this._onConnection = cb;
  }

  onStop() {
    this._clientChannelPort && this._clientChannelPort.postMessage({
      type: 'disconnect'
    });
    this._clientChannelPort && this._clientChannelPort.close();
  }

}
/**
 * ServerChannel implements IChannelServer
 *
 * server connection implementation
 */

class ServerChannel {
  constructor({
    clientChannelPort,
    debug
  }) {
    this.clientChannelPort = clientChannelPort;
    this.debug = debug || false;
  }

  connect() {
    return {
      disconnect: () => {
        this.clientChannelPort.postMessage(newMessage({
          payload: null,
          type: 'disconnect'
        }));
        listeners.forEach(({
          func,
          type,
          scope
        }) => scope === 'port' ? this.clientChannelPort.removeEventListener(type, func) : // $FlowFixMe
        removeEventListener(type, func));
      },
      receive: cb => {
        listeners = updateListeners({
          func: requestMessage,
          listeners,
          type: 'message',
          scope: 'port'
        });
        this.clientChannelPort.addEventListener('message', eventMsg => requestMessage(eventMsg, cb, this.debug));
      },
      send: msg => {
        if (this.debug) {
          console.log(`Server responses with payload: ${JSON.stringify(msg)}`);
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
  const {
    payload,
    type
  } = getMessageData(eventMsg);

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
    case 'close':
      {
        onStop();
      }
  }
};

/**
 * written with <3 by scaleCube-js maintainers
 *
 * RSocketEventsServer Transport provider for event base messages
 * browser <--> browser
 *
 *      
 */
/**
 * A Events transport server.
 */

class RSocketEventsServer {
  constructor(options) {
    this._subscribers = new Set();
    this.address = options.address;
    this._server = new EventsServer(options);
  }

  start() {
    return new Flowable(subscriber => {
      subscriber.onSubscribe({
        cancel: () => {
          if (!this._server) {
            return;
          }

          this._server.onStop();
        },
        request: () => {
          this._server.onConnect(eventClient => {
            const eventClientConnection = new RSocketEventsClient({
              address: this.address,
              eventClient
            });

            if (eventClientConnection) {
              this._subscribers.add(eventClientConnection);

              eventClientConnection.connect();
              subscriber.onNext(eventClientConnection);
            } else {
              subscriber.onError(new Error(`unable to create connection - address: ${this.address}`));
            }
          });
        }
      });
    });
  }

  stop() {
    if (!this._subscribers) {
      return;
    }

    this._subscribers.forEach(subscriber => subscriber.close());

    this._subscribers.clear();
  }

}

/** Copyright (c) Facebook, Inc. and its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 *      
 */

export default RSocketEventsServer;
