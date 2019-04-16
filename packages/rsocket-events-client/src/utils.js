/**
 *
 * @flow
 */

export const newMessage = ({ type, payload }: NewMessageOptions) =>
  ({
    type,
    cid: Date.now() + "-" + Math.random(),
    payload
  });

export const getMessageData = (eventMsg?: { data: any }): any =>
  eventMsg ? eventMsg.data : null;

export const updateListeners = ({ listeners = [], type, func }: UpdateListenersOptions) => (type && func) ?
  [...listeners, { type, func }] :
  [...listeners];


export interface IEventListener {
  type: string;
  func: (...data: any[]) => any;
}

interface UpdateListenersOptions {
  type: string;
  func: Function;
  listeners?: IEventListener[];
}

interface NewMessageOptions {
  payload?: any;
  type?: string;
}
