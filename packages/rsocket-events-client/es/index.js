import { Flowable } from 'rsocket-flowable';
import { CONNECTION_STATUS } from 'rsocket-types';
import invariant from 'fbjs/lib/invariant';

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
    invariant(this._status.kind === 'NOT_CONNECTED', 'RSocketEventsClient: Cannot connect(), a connection is already ' + 'established.');

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

export default RSocketEventsClient;
export { genericPostMessage, getMessageData, newMessage, setLocalAddress, updateListeners };
