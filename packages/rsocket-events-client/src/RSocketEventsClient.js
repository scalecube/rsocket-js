/**
 * written with <3 by scaleCube-js maintainers
 *
 * @flow
 */

"use strict";

import type { ConnectionStatus, DuplexConnection, Frame, ISubject } from "rsocket-types";
import EventsClient from "./EventsClient";
import { Flowable } from "rsocket-flowable";
import type { Connection } from "./Connect";
import { CONNECTION_STATUS } from "rsocket-types";

/**
 * A WebSocket transport client for use in browser environments.
 */
export default class RSocketEventsClient implements DuplexConnection {
  _eventsClient: EventsClient | null;
  _receivers: Set<any>;
  _address: string;
  connection: Connection;
  _statusSubscribers: Set<ISubject<ConnectionStatus>>;
  constructor(options: { eventClient?: Object; address: string; address: string }) {
    this._receivers = new Set();
    this._eventsClient = options.eventClient || new EventsClient({ eventType: "defaultEventsListener" });
    this._address = options.address;
    this._statusSubscribers = new Set();
  }

  /**
   * Send a single frame on the connection.
   */
  sendOne(frame: Frame): void {
    if ( !this.connection ) {
      return;
    }
    this.connection.send(frame);
  }

  /**
   * Send all the `input` frames on this connection.
   *
   * Notes:
   * - Implementations must not cancel the subscription.
   * - Implementations must signal any errors by calling `onError` on the
   *   `receive()` Publisher.
   */
  send(input: Flowable<Frame>): void {
    if ( !this.connection ) {
      return;
    }
    input.subscribe(frame => this.connection.send(frame));
  }

  /**
   * Returns a stream of all `Frame`s received on this connection.
   *
   * Notes:
   * - Implementations must call `onComplete` if the underlying connection is
   *   closed by the peer or by calling `close()`.
   * - Implementations must call `onError` if there are any errors
   *   sending/receiving frames.
   * - Implemenations may optionally support multi-cast receivers. Those that do
   *   not should throw if `receive` is called more than once.
   */
  receive(): Flowable<Frame> {
    return new Flowable(subject => {
      subject.onSubscribe({
        cancel: () => {
          this._receivers.delete(subject);
        },
        request: () => {
          this._receivers.add(subject);
        }
      });
    });
  }

  /**
   * Close the underlying connection, emitting `onComplete` on the receive()
   * Publisher.
   */
  close(): void {
    this.connection && typeof this.connection.disconnect === "function" && this.connection.disconnect();
    this._eventsClient = null;
  }

  /**
   * Open the underlying connection. Throws if the connection is already in
   * the CLOSED or ERROR state.
   */
  connect(): void {
    if (this._eventsClient){
      this.connection = this._eventsClient.connect(this._address);
      this.connection.receive((e) => {
        const frame = e.payload; //this._readFrame(e.payload);
        this._receivers.forEach(subscriber => subscriber.onNext(frame));
      });
    } else {
      console.log('connection is closed');
    }
  }

  /**
   * Returns a Flowable that immediately publishes the current connection
   * status and thereafter updates as it changes. Once a connection is in
   * the CLOSED or ERROR state, it may not be connected again.
   * Implementations must publish values per the comments on ConnectionStatus.
   */
  connectionStatus(): Flowable<ConnectionStatus> {
    return new Flowable(subscriber => {
      subscriber.onSubscribe({
        cancel: () => {
          this._statusSubscribers.delete(subscriber);
        },
        request: () => {
          this._statusSubscribers.add(subscriber);
          subscriber.onNext(CONNECTION_STATUS.CONNECTING);
        },
      });
    });
  }


}

