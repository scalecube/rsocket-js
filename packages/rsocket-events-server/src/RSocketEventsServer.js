/**
 * written with <3 by scaleCube-js maintainers
 *
 * RSocketEventsServer Transport provider for event base messages
 * browser <--> browser
 *
 * @flow
 */

'use strict';

import {Flowable} from 'rsocket-flowable';
import RSocketEventsClient from 'rsocket-events-client';
import EventsServer from './EventsServer';
import type {TransportServer} from 'rsocket-core';
import type {ConnectionStatus, DuplexConnection, Frame} from 'rsocket-types';

export type ServerOptions = {
  address: string,
  eventType?: string,
  processEvent?: (ev: any) => any,
  debug: boolean,
};

/**
 * A Events transport server.
 */
export default class RSocketEventsServer implements TransportServer {
  _server: any;
  address: string;
  _subscribers: Set<DuplexConnection>;

  constructor(options: ServerOptions) {
    this._subscribers = new Set();
    this.address = options.address;
    this._server = new EventsServer(options);
  }

  start(): Flowable<DuplexConnection> {
    return new Flowable(subscriber => {
      subscriber.onSubscribe({
        cancel: () => {
          if (!this._server) {
            return;
          }
          this._server.onStop();
        },
        request: () => {
          this._server.onConnect(eventClient => {
            const eventClientConnection = new RSocketEventsClient({
              address: this.address,
              eventClient,
            });
            if (eventClientConnection) {
              this._subscribers.add(eventClientConnection);
              eventClientConnection.connect();
              subscriber.onNext(eventClientConnection);
            } else {
              subscriber.onError(
                new Error(
                  `unable to create connection - address: ${this.address}`,
                ),
              );
            }
          });
        },
      });
    });
  }

  stop(): void {
    if (!this._subscribers) {
      return;
    }
    this._subscribers.forEach(subscriber => subscriber.close());
    this._subscribers.clear();
  }
}
