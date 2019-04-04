/** Copyright (c) Facebook, Inc. and its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @flow
 */


'use strict';

import type {Encoders, TransportServer} from 'rsocket-core';
import {Flowable} from 'rsocket-flowable';
import EventsServer from "./EventsServer";
import type {ConnectionStatus, DuplexConnection, Frame} from 'rsocket-types';
import RSocketEventsClient from "rsocket-events-client/src";

export type ServerOptions = {|
  host?: string,
  port: number,
  backlog?: number,
  server?: any,
  verifyClient?: Function,
  handleProtocols?: Function,
  path?: string,
  noServer?: boolean,
  clientTracking?: boolean,
  perMessageDeflate?: any,
  maxPayload?: number,
|};

/**
 * A Events transport server.
 */
export default class RSocketEventsServer implements TransportServer {
  constructor(options: ServerOptions, encoders?: ?Encoders<*>) {
    this._server = new EventsServer({
      address: `pm://${options.host}${options.path}${options.port ? ":" + options.port : ""}`
    });
  }

  start(): Flowable<DuplexConnection> {
    return new Flowable(subscriber => {
      subscriber.onSubscribe({
        cancel: () => {

        },
        request: n => {
          this._server.onConnect((ec)=> {
            const connection = new RSocketEventsClient({eventClient: ec});
            connection.connect();
            subscriber.onNext(connection)
          });
        },
      });
    });
  }
  stop(): void {

  }
}
