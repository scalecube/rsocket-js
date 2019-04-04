/**
 * written with <3 by scaleCube-js maintainers
 *
 * @flow
 */

'use strict';

import type {DuplexConnection, Frame} from 'rsocket-types';
import type {ConnectionStatus} from "rsocket-types/src";

/**
 * A WebSocket transport client for use in browser environments.
 */
export default class RSocketEventsClient implements DuplexConnection {
  _eventsClient: EventsClient;
  constructor(options){
    this._receivers = new Set();
    this._eventsClient = options.eventClient || new EventsClient();
    this._address = options.address;
  }
  /**
   * Send a single frame on the connection.
   */
  sendOne(frame: Frame):void {
    if( !this.connection ) {
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
  send(input: Flowable<Frame>):void {
    if( !this.connection ) {
      return;
    }
    input.subscribe(frame => this.connection.send(frame))
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
  receive(): Flowable<Frame>{
    return new Flowable(subject => {
      subject.onSubscribe({
        cancel: () => {
          this._receivers.delete(subject);
        },
        request: () => {
          this._receivers.add(subject);
        },
      });
    });
  }

  /**
   * Close the underlying connection, emitting `onComplete` on the receive()
   * Publisher.
   */
  close(): void {
    this._eventsClient.disconnect();
    this.connection = null;
  }

  /**
   * Open the underlying connection. Throws if the connection is already in
   * the CLOSED or ERROR state.
   */
  connect(): void {
    this.connection = this._eventsClient.connect(this._address);
    this.connection.receive((e) => {
      const frame = this._readFrame(e.payload);
      this._receivers.forEach(subscriber => subscriber.onNext(frame));
    });
  }

  /**
   * Returns a Flowable that immediately publishes the current connection
   * status and thereafter updates as it changes. Once a connection is in
   * the CLOSED or ERROR state, it may not be connected again.
   * Implementations must publish values per the comments on ConnectionStatus.
   */
  connectionStatus(): Flowable<ConnectionStatus> {

  }

}

