/**
 * @flow
 */
import type {IEventListener} from 'rsocket-events-client';

export interface Connection {
  send(msg: Object): void,

  receive(cb: Function): void,

  disconnect(): void,
}

export interface ChannelOptionsServer {
  clientChannelPort: MessagePort,
  listeners?: IEventListener[],
  debug ?: boolean | null,
}

export interface IChannelServer {
  constructor(options: ChannelOptionsServer): void,

  connect(): Connection,
}
