/**
 * @flow
 */

export interface Connection {
  send(msg: Object): void,

  receive(cb: Function): void,

  disconnect(): void,
}

export interface ChannelOptionsClient {
  eventType?: string,
  confirmConnectionOpenCallback?: Function
}

export interface IChannelClient {
  constructor(options: ChannelOptionsClient): void,

  connect(address: string): Connection,
}
