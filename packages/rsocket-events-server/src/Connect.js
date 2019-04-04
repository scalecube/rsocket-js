/**
 * @flow
 */
export interface Connection {
  send(msg: Object): void;

  receive(cb: any): void;

  disconnect(): void;
}

export interface ConnectOptions {
  eventType?: string
}


export interface Connect {
  constructor(options: ConnectOptions): void;

  connect(address: string): Connection;
}

