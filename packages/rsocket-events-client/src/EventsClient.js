/**
 * @flow env=browser,webworker,webworker
 */


import {getMessageData, newMessage, updateListeners} from './utils';
import type {IEventListener} from './utils';
import type {IChannelClient, ChannelOptionsClient, Connection} from './EventsChannelClient';

export default class EventsClient implements IChannelClient {
  eventType: string;
  confirmConnectionOpenCallback: Function | void;

  constructor(option: ChannelOptionsClient) {
    this.eventType = option.eventType || 'defaultEventsListener';
    this.confirmConnectionOpenCallback = option.confirmConnectionOpenCallback;
  }

  connect(address: string): Connection {

    let channel: MessageChannel = new MessageChannel();
    let listeners: IEventListener[];
    // $FlowFixMe
    typeof postMessage === 'function' && postMessage({ // eslint-disable-line
      detail: {
        address,
        type: 'open',
      },
      type: this.eventType,
    }, '*', [channel.port2]);

    const initConnection = eventMsg => {
      const {type} = getMessageData(eventMsg);
      switch (type) {
        case 'connect': {
          typeof this.confirmConnectionOpenCallback === 'function' && this.confirmConnectionOpenCallback();
          break;
        }
        case 'disconnect': {
          if (channel) {
            channel.port1.close();
            Array.isArray(listeners) && listeners.forEach(({type, func}) => channel.port1.removeEventListener(type, func));
            channel = null;
          }
          break;
        }
      }
    };

    listeners = updateListeners({
      func: initConnection,
      type: 'message',
    });
    channel.port1.addEventListener('message', initConnection);
    channel.port1.start();

    return Object.freeze({
      disconnect: () => {
        channel.port1.postMessage(newMessage({
          payload: null,
          type: 'close',
        }));
      },
      receive: cb => {

        const responseMessage = eventMsg => {
          const {type, payload} = getMessageData(eventMsg);
          if (type === 'response') {
            cb(payload);
          }
        };

        listeners = updateListeners({
          func: responseMessage,
          listeners,
          type: 'message',
        });
        channel.port1.addEventListener('message', responseMessage);
      },
      send: msg => {
        channel.port1.postMessage(newMessage({
          payload: msg,
          type: 'request',
        }));
      },
    });
  }
}

