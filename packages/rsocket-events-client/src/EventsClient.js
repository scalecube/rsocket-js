/**
 * @flow
 */

import {
  genericPostMessage,
  getMessageData,
  newMessage,
  updateListeners,
} from './utils';
import type {IEventListener} from './utils';
import type {
  IChannelClient,
  ChannelOptionsClient,
  Connection,
} from './EventsChannelClient';

/**
 * EventsClient implements IChannelClient
 *
 * initiate connection with a server.
 *
 */

let listeners: IEventListener[] = [];

export default class EventsClient implements IChannelClient {
  eventType: string;
  confirmConnectionOpenCallback: Function | void;
  debug: boolean;

  constructor(option: ChannelOptionsClient) {
    this.eventType = option.eventType || 'RsocketEvents';
    this.confirmConnectionOpenCallback = option.confirmConnectionOpenCallback;
    this.debug = option.debug || false;
  }

  connect(address: string): Connection {
    let channel: MessageChannel | null = new MessageChannel();

    if (!channel) {
      throw new Error('MessageChannel not supported');
    }

    // send open message to the server with a port message
    pingServer(this.eventType, channel, address);

    listeners = updateListeners({
      func: initConnection,
      type: 'message',
      scope: 'port',
    });

    // start to listen to the port
    startListen(channel, this.confirmConnectionOpenCallback);

    if (channel && channel.port1) {
      const {port1} = channel;

      return Object.freeze({
        disconnect: () => {
          port1.postMessage(
            newMessage({
              payload: null,
              type: 'close',
            }),
          );

          Array.isArray(listeners) &&
            listeners.forEach(
              ({type, func, scope}) =>
                scope === 'port'
                  ? port1 && port1.removeEventListener(type, func)
                  : // $FlowFixMe
                    removeEventListener(type, func),
            );
        },
        receive: cb => {
          listeners = updateListeners({
            func: responseMessage,
            listeners,
            type: 'message',
            scope: 'port',
          });

          port1.addEventListener('message', eventMsg =>
            responseMessage(eventMsg, this.debug, cb));
        },
        send: msg => {
          if (this.debug) {
            console.log(
              `Client send request with payload: ${JSON.stringify(msg)}`,
            );
          }

          port1.postMessage(
            newMessage({
              payload: msg,
              type: 'request',
            }),
          );
        },
      });
    } else {
      throw new Error('Unable to use port message');
    }
  }
}

const pingServer = (type, channel, address) => {
  genericPostMessage(
    {
      detail: {
        address,
        type: 'rsocket-events-open-connection',
      },
      type,
    },
    [channel.port2],
  );
};

const startListen = (channel, confirmConnectionOpenCallback) => {
  if (channel && channel.port1) {
    const {port1} = channel;
    port1.addEventListener('message', eventMsg =>
      initConnection(eventMsg, channel, confirmConnectionOpenCallback, port1));
    port1.start();
  }
};

const initConnection = (
  eventMsg,
  channel,
  confirmConnectionOpenCallback,
  port1,
) => {
  const {type} = getMessageData(eventMsg);
  switch (type) {
    case 'connect': {
      typeof confirmConnectionOpenCallback === 'function' &&
        confirmConnectionOpenCallback();
      break;
    }
    case 'disconnect': {
      if (channel) {
        port1 && port1.close();

        Array.isArray(listeners) &&
          listeners.forEach(
            ({type, func, scope}) =>
              scope === 'port' &&
              port1 &&
              port1.removeEventListener(type, func),
          );

        port1 = null;
        channel = null;
      }
      break;
    }
  }
};

const responseMessage = (eventMsg, debug, cb) => {
  const {type, payload} = getMessageData(eventMsg);
  if (type === 'response') {
    if (debug) {
      console.log(`Client receive response with payload: ${payload}`);
    }
    cb(payload);
  }
};
