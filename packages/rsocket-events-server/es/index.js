import { Flowable } from 'rsocket-flowable';
import { CONNECTION_STATUS } from 'rsocket-types';

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

const genericPostMessage = (data, transfer) => {
  try {
    // $FlowFixMe
    if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
      if (localAddress.indexOf(data.detail.address) > -1) {
        const event = new MessageEvent('message', {
          data,
          ports: transfer ? transfer : undefined
        });
        dispatchEvent(event);
      } else {
        // $FlowFixMe
        postMessage(data, transfer ? transfer : undefined);
      }
    } else {
      // $FlowFixMe
      postMessage(data, '*', transfer ? transfer : undefined);
    }
  } catch (e) {
    console.error('Unable to post message ', e);
  }
};
/**
 *      
 */

/**
 * EventsClient implements IChannelClient
 *
 * initiate connection with a server.
 *
 */


let listeners = [];

class EventsClient {
  constructor(option) {
    this.eventType = option.eventType || 'RsocketEvents';
    this.confirmConnectionOpenCallback = option.confirmConnectionOpenCallback;
    this.debug = option.debug || false;
  }

  connect(address) {
    let channel = new MessageChannel();

    if (!channel) {
      throw new Error('MessageChannel not supported');
    } // send open message to the server with a port message


    pingServer(this.eventType, channel, address);
    listeners = updateListeners({
      func: initConnection,
      type: 'message',
      scope: 'port'
    }); // start to listen to the port

    startListen(channel, this.confirmConnectionOpenCallback);

    if (channel && channel.port1) {
      const {
        port1
      } = channel;
      return Object.freeze({
        disconnect: () => {
          port1.postMessage(newMessage({
            payload: null,
            type: 'close'
          }));
          Array.isArray(listeners) && listeners.forEach(({
            type,
            func,
            scope
          }) => scope === 'port' ? port1 && port1.removeEventListener(type, func) : // $FlowFixMe
          removeEventListener(type, func));
        },
        receive: cb => {
          listeners = updateListeners({
            func: responseMessage,
            listeners,
            type: 'message',
            scope: 'port'
          });
          port1.addEventListener('message', eventMsg => responseMessage(eventMsg, this.debug, cb));
        },
        send: msg => {
          if (this.debug) {
            console.log(`Client send request with payload: ${JSON.stringify(msg)}`);
          }

          port1.postMessage(newMessage({
            payload: msg,
            type: 'request'
          }));
        }
      });
    } else {
      throw new Error('Unable to use port message');
    }
  }

}

const pingServer = (type, channel, address) => {
  genericPostMessage({
    detail: {
      address,
      type: 'rsocket-events-open-connection'
    },
    type
  }, [channel.port2]);
};

const startListen = (channel, confirmConnectionOpenCallback) => {
  if (channel && channel.port1) {
    const {
      port1
    } = channel;
    port1.addEventListener('message', eventMsg => initConnection(eventMsg, channel, confirmConnectionOpenCallback, port1));
    port1.start();
  }
};

const initConnection = (eventMsg, channel, confirmConnectionOpenCallback, port1) => {
  const {
    type
  } = getMessageData(eventMsg);

  switch (type) {
    case 'connect':
      {
        typeof confirmConnectionOpenCallback === 'function' && confirmConnectionOpenCallback();
        break;
      }

    case 'disconnect':
      {
        if (channel) {
          port1 && port1.close();
          Array.isArray(listeners) && listeners.forEach(({
            type,
            func,
            scope
          }) => scope === 'port' && port1 && port1.removeEventListener(type, func));
          port1 = null;
          channel = null;
        }

        break;
      }
  }
};

const responseMessage = (eventMsg, debug, cb) => {
  const {
    type,
    payload
  } = getMessageData(eventMsg);

  if (type === 'response') {
    if (debug) {
      console.log(`Client receive response with payload: ${payload}`);
    }

    cb(payload);
  }
};
/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * Use invariant() to assert state which your program assumes to be true.
 *
 * Provide sprintf-style format (only %s is supported) and arguments
 * to provide information about what broke and what you were
 * expecting.
 *
 * The invariant message will be stripped in production, but the invariant
 * will remain to ensure logic does not differ in production.
 */


var validateFormat = function validateFormat(format) {};

if (process.env.NODE_ENV !== 'production') {
  validateFormat = function validateFormat(format) {
    if (format === undefined) {
      throw new Error('invariant requires an error message argument');
    }
  };
}

function invariant(condition, format, a, b, c, d, e, f) {
  validateFormat(format);

  if (!condition) {
    var error;

    if (format === undefined) {
      error = new Error('Minified exception occurred; use the non-minified dev environment ' + 'for the full error message and additional helpful warnings.');
    } else {
      var args = [a, b, c, d, e, f];
      var argIndex = 0;
      error = new Error(format.replace(/%s/g, function () {
        return args[argIndex++];
      }));
      error.name = 'Invariant Violation';
    }

    error.framesToPop = 1; // we don't care about invariant's own frame

    throw error;
  }
}

var invariant_1 = invariant;
/**
 * written with <3 by scaleCube-js maintainers
 *
 * RSocketEventsClient Transport provider for event base messages
 * browser <--> browser
 *
 *      
 */

/**
 * A WebSocket transport client for use in browser environments.
 */

class RSocketEventsClient {
  constructor({
    eventClient,
    address,
    debug = false
  }) {
    this._receivers = new Set();
    this._eventsClient = eventClient || new EventsClient({
      confirmConnectionOpenCallback: this.confirmConnectionOpenCallback.bind(this),
      eventType: 'RsocketEvents',
      debug
    });
    this._address = address;
    this._statusSubscribers = new Set();
    this._status = CONNECTION_STATUS.NOT_CONNECTED;
    this.debug = debug;
  }

  confirmConnectionOpenCallback() {
    this._setConnectionStatus(CONNECTION_STATUS.CONNECTED);
  }
  /**
   * Send a single frame on the connection.
   */


  sendOne(frame) {
    if (!this.connection) {
      return;
    }

    this.connection.send(frame);
  }
  /**
   * Send all the `input` frames on this connection.
   *
   * Notes:
   * - Implementations must not cancel the subscription.
   * - Implementations must signal any errors by calling `onError` on the
   *   `receive()` Publisher.
   */


  send(input) {
    if (!this.connection) {
      return;
    }

    input.subscribe(frame => {
      if (this.debug) {
        console.log('RSocketEventsClient send frame: ', frame);
      }

      this.connection.send(frame);
    });
  }
  /**
   * Returns a stream of all `Frame`s received on this connection.
   *
   * Notes:
   * - Implementations must call `onComplete` if the underlying connection is
   *   closed by the peer or by calling `close()`.
   * - Implementations must call `onError` if there are any errors
   *   sending/receiving frames.
   * - Implemenations may optionally support multi-cast receivers. Those that do
   *   not should throw if `receive` is called more than once.
   */


  receive() {
    return new Flowable(subject => {
      subject.onSubscribe({
        cancel: () => {
          this._receivers.delete(subject);
        },
        request: () => {
          this._receivers.add(subject);
        }
      });
    });
  }
  /**
   * Close the underlying connection, emitting `onComplete` on the receive()
   * Publisher.
   */


  close(error) {
    if (this._status.kind === 'CLOSED' || this._status.kind === 'ERROR') {
      // already closed
      return;
    }

    const status = error ? {
      error,
      kind: 'ERROR'
    } : CONNECTION_STATUS.CLOSED;

    this._setConnectionStatus(status);

    this._receivers.forEach(subscriber => {
      if (error) {
        subscriber.onError(error);
      } else {
        subscriber.onComplete();
      }
    });

    this._receivers.clear();

    this.connection && typeof this.connection.disconnect === 'function' && this.connection.disconnect();
    this._eventsClient = null;
  }
  /**
   * Open the underlying connection. Throws if the connection is already in
   * the CLOSED or ERROR state.
   */


  connect() {
    invariant_1(this._status.kind === 'NOT_CONNECTED', 'RSocketEventsClient: Cannot connect(), a connection is already ' + 'established.');

    this._setConnectionStatus(CONNECTION_STATUS.CONNECTING);

    if (this._eventsClient) {
      const _eventsClient = this._eventsClient;

      this._setConnectionStatus(CONNECTION_STATUS.CONNECTING);

      this.connection = _eventsClient.connect(this._address);
      this.connection.receive(frame => {
        if (this.debug) {
          console.log('RSocketEventsClient received frame: ', frame);
        }

        frame && this._receivers.forEach(subscriber => subscriber.onNext(frame));
      });
    } else {
      console.log('connection is closed');
    }
  }
  /**
   * Returns a Flowable that immediately publishes the current connection
   * status and thereafter updates as it changes. Once a connection is in
   * the CLOSED or ERROR state, it may not be connected again.
   * Implementations must publish values per the comments on ConnectionStatus.
   */


  connectionStatus() {
    return new Flowable(subscriber => {
      subscriber.onSubscribe({
        cancel: () => {
          this._statusSubscribers.delete(subscriber);
        },
        request: () => {
          this._statusSubscribers.add(subscriber);

          subscriber.onNext(this._status);
        }
      });
    });
  }

  _setConnectionStatus(status) {
    this._status = status;

    this._statusSubscribers.forEach(subscriber => subscriber.onNext(status));
  }

}

/**
 *
 *      
 */
const newMessage$1 = ({
  type,
  payload
}) => ({
  cid: Date.now() + '-' + Math.random(),
  payload,
  type
}); // $FlowFixMe

const getMessageData$1 = ({
  data
}) => data || null;
const updateListeners$1 = ({
  listeners = [],
  type,
  func,
  scope
}) => type && func ? [...listeners, {
  func,
  type,
  scope
}] : [...listeners];
let localAddress$1 = [];
const setLocalAddress = address => {
  localAddress$1 = [...localAddress$1, address];
  return localAddress$1;
};

/**
 *      
 */
let listeners$1 = [];
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
    listeners$1 = updateListeners$1({
      func: this._handler,
      listeners: listeners$1,
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

      listeners$1 = updateListeners$1({
        func: connectionHandler,
        listeners: listeners$1,
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
        this.clientChannelPort.postMessage(newMessage$1({
          payload: null,
          type: 'disconnect'
        }));
        listeners$1.forEach(({
          func,
          type,
          scope
        }) => scope === 'port' ? this.clientChannelPort.removeEventListener(type, func) : // $FlowFixMe
        removeEventListener(type, func));
      },
      receive: cb => {
        listeners$1 = updateListeners$1({
          func: requestMessage,
          listeners: listeners$1,
          type: 'message',
          scope: 'port'
        });
        this.clientChannelPort.addEventListener('message', eventMsg => requestMessage(eventMsg, cb, this.debug));
      },
      send: msg => {
        if (this.debug) {
          console.log(`Server responses with payload: ${JSON.stringify(msg)}`);
        }

        this.clientChannelPort.postMessage(newMessage$1({
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
  } = getMessageData$1(eventMsg);

  if (type === 'request') {
    if (debug) {
      console.log(`Server receive request with payload: ${payload}`);
    }

    cb(payload);
  }
};

const connectionHandler = (ev, onStop) => {
  const event = getMessageData$1(ev);

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
