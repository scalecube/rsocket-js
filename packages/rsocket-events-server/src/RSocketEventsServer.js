/** Copyright (c) Facebook, Inc. and its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @flow
 */


'use strict';

import { Flowable } from 'rsocket-flowable';
import RSocketEventsClient from 'rsocket-events-client';
import EventsServer from './EventsServer';
import type { TransportServer } from 'rsocket-core';
import type { ConnectionStatus, DuplexConnection, Frame } from 'rsocket-types';

export type ServerOptions = {
  address: string,
  eventType?: string,
  processEvent?: (ev: any) => any
}

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
          if ( !this._server ) {
            return;
          }
          this._server.onStop();
        },
        request: () => {
          this._server.onConnect(eventClient => {
            const eventClientConnection = new RSocketEventsClient({ address: this.address, eventClient });
            if ( eventClientConnection ) {
              this._subscribers.add(eventClientConnection);
              eventClientConnection.connect();
              subscriber.onNext(eventClientConnection);
            } else {
              subscriber.error(`unable to create connection - address: ${ this.address }`);
            }
          });
        }
      });
    });
  }

  stop(): void {
    if ( !this._subscribers ) {
      return;
    }
    this._subscribers.forEach(subscriber => subscriber.close());
    this._subscribers.clear();
  }
}
