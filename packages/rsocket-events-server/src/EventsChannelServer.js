/**
 * @flow
 */
import type { IEventListener } from "rsocket-events-client";

export interface Connection {
  send(msg: Object): void;

  receive(cb: Function): void;

  disconnect(): void;
}

export interface ChannelOptionsServer {
  clientChannelPort?: string;
  listeners?: IEventListener[];
}

export interface IChannelServer {
  constructor(options: ChannelOptionsServer): void;

  connect(): Connection;
}
