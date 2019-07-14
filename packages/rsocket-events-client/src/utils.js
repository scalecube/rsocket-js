/**
 *
 * @flow
 */

export const newMessage = ({ type, payload }: NewMessageOptions) =>
  ({
    cid: Date.now() + '-' + Math.random(),
    payload,
    type
  });

// $FlowFixMe
export const getMessageData = ({ data }: { data?: any }): any =>
  data || null;

export const updateListeners = ({ listeners = [], type, func, scope }: UpdateListenersOptions) => (type && func) ?
  [...listeners, { func, type, scope }] :
  [...listeners];


export interface IEventListener {
  func: (...data: any[]) => any,
  type: string,
  scope: string
}

interface UpdateListenersOptions {
  func: Function,
  listeners?: IEventListener[],
  type: string,
  scope: string,
}

interface NewMessageOptions {
  payload?: any,
  type?: string,
}

export const genericPostMessage = (data: any, transfer?: any[]) => {
  try {
    // $FlowFixMe
    if ( typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope ) {
      // $FlowFixMe
      postMessage(data, transfer ? transfer : undefined);
      const event = new MessageEvent('message', {
        data,
        ports: transfer ? transfer : undefined
      });
      // $FlowFixMe
      dispatchEvent(event);
    } else {
      // $FlowFixMe
      postMessage(data, '*', transfer ? transfer : undefined);
    }
  } catch ( e ) {
    console.error('Unable to post message ', e);
  }
};
