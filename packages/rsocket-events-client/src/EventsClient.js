/**
 * @flow
 */


import { getMessageData, newMessage, updateListeners } from './utils';
import type { IEventListener } from './utils';
import type { IChannelClient, ChannelOptionsClient, Connection } from './EventsChannelClient';

/**
 * EventsClient implements IChannelClient
 *
 * initiate connection with a server.
 *
 */
export default class EventsClient implements IChannelClient {
  eventType: string;
  confirmConnectionOpenCallback: Function | void;
  debug: boolean;

  constructor(option: ChannelOptionsClient) {
    this.eventType = option.eventType || 'defaultEventsListener';
    this.confirmConnectionOpenCallback = option.confirmConnectionOpenCallback;
    this.debug = option.debug || false;
  }

  connect(address: string): Connection {

    let channel: MessageChannel | null = new MessageChannel();
    let listeners: IEventListener[];

    if ( !channel ) {
      throw new Error('MessageChannel not supported');
    }

    // send open message to the server with a port message
    pingServer(this.eventType, channel);

    listeners = updateListeners({
      func: initConnection,
      type: 'message'
    });

    // start to listen to the port
    startListen(channel, this.confirmConnectionOpenCallback);


    if ( channel && channel.port1 ) {
      const { port1 } = channel;

      return Object.freeze({
        disconnect: () => {
          port1.postMessage(newMessage({
            payload: null,
            type: 'close'
          }));
        },
        receive: cb => {

          listeners = updateListeners({
            func: responseMessage,
            listeners,
            type: 'message'
          });

          port1.addEventListener('message', (eventMsg) => responseMessage(eventMsg, this.debug, cb));
        },
        send: msg => {

          if ( this.debug ) {
            console.log(`Client send request with payload: ${ JSON.stringify(msg) }`);
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

const pingServer = (type, channel) => {
  // $FlowFixMe
  typeof postMessage === 'function' && postMessage({ // eslint-disable-line
    detail: {
      address,
      type: 'open'
    },
    type
  }, '*', [channel.port2]);
};

const startListen = (channel, confirmConnectionOpenCallback) => {
  if ( channel && channel.port1 ) {
    const { port1 } = channel;
    port1.addEventListener('message', (eventMsg) => initConnection(eventMsg, channel, confirmConnectionOpenCallback, port1));
    port1.start();
  }
};

const initConnection = (eventMsg, channel, confirmConnectionOpenCallback, port1) => {
  const { type } = getMessageData(eventMsg);
  switch ( type ) {
    case 'connect': {
      typeof confirmConnectionOpenCallback === 'function' && confirmConnectionOpenCallback();
      break;
    }
    case 'disconnect': {
      if ( channel ) {
        port1.close();
        Array.isArray(listeners) && listeners.forEach(({ type, func }) => port1.removeEventListener(type, func));
        port1 = null;
        channel = null;
      }
      break;
    }
  }
};

const responseMessage = (eventMsg, debug, cb) => {
  const { type, payload } = getMessageData(eventMsg);
  if ( type === 'response' ) {
    if ( debug ) {
      console.log(`Client receive response with payload: ${ payload }`);
    }
    cb(payload);
  }
};
