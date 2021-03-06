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

export const updateListeners = ({ listeners = [], type, func }: UpdateListenersOptions) => (type && func) ?
  [...listeners, { func, type }] :
  [...listeners];


export interface IEventListener {
  func: (...data: any[]) => any,
  type: string,
}

interface UpdateListenersOptions {
  func: Function,
  listeners?: IEventListener[],
  type: string,
}

interface NewMessageOptions {
  payload?: any,
  type?: string,
}
