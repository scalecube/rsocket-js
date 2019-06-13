/**
 * written with <3 by scaleCube-js maintainers
 *
 * RSocketEventsClient Transport provider for event base messages
 * browser <--> browser
 *
 * @flow
 */

'use strict';

import type { ConnectionStatus, DuplexConnection, Frame, ISubject } from 'rsocket-types';
import EventsClient from './EventsClient';
import { Flowable } from 'rsocket-flowable';
import type { Connection } from './EventsChannelClient';
import { CONNECTION_STATUS } from 'rsocket-types';
import invariant from 'fbjs/lib/invariant';

/**
 * A WebSocket transport client for use in browser environments.
 */
export default class RSocketEventsClient implements DuplexConnection {
  _eventsClient: EventsClient | null;
  _receivers: Set<any>;
  _address: string;
  connection: Connection;
  _statusSubscribers: Set<ISubject<ConnectionStatus>>;
  _status: ConnectionStatus;
  debug: boolean;

  constructor({ eventClient, address, debug = false }: { eventClient?: Object, address: string, debug?: boolean }) {
    this._receivers = new Set();
    this._eventsClient = eventClient || new EventsClient({
      confirmConnectionOpenCallback: this.confirmConnectionOpenCallback.bind(this),
      eventType: 'defaultEventsListener',
      debug
    });
    this._address = address;
    this._statusSubscribers = new Set();
    this._status = CONNECTION_STATUS.NOT_CONNECTED;
    this.debug = debug;
  }

  confirmConnectionOpenCallback() {
    this._setConnectionStatus(CONNECTION_STATUS.CONNECTED);
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
    input.subscribe(frame => {
      if ( this.debug ) {
        console.log('RSocketEventsClient send frame: ', frame);
      }
      this.connection.send(frame);
    });
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
  close(error?: Error): void {
    if ( this._status.kind === 'CLOSED' || this._status.kind === 'ERROR' ) {
      // already closed
      return;
    }
    const status = error ? { error, kind: 'ERROR' } : CONNECTION_STATUS.CLOSED;
    this._setConnectionStatus(status);

    this._receivers.forEach(subscriber => {
      if ( error ) {
        subscriber.onError(error);
      } else {
        subscriber.onComplete();
      }
    });
    this._receivers.clear();

    this.connection && typeof this.connection.disconnect === 'function' && this.connection.disconnect();
    this._eventsClient = null;
  }

  /**
   * Open the underlying connection. Throws if the connection is already in
   * the CLOSED or ERROR state.
   */
  connect(): void {
    invariant(
      this._status.kind === 'NOT_CONNECTED',
      'RSocketEventsClient: Cannot connect(), a connection is already ' +
      'established.'
    );
    this._setConnectionStatus(CONNECTION_STATUS.CONNECTING);


    if ( this._eventsClient ) {
      const _eventsClient = this._eventsClient;
      this._setConnectionStatus(CONNECTION_STATUS.CONNECTING);

      this.connection = _eventsClient.connect(this._address);
      this.connection.receive(frame => {
        if ( this.debug ) {
          console.log('RSocketEventsClient received frame: ', frame);
        }
        frame && this._receivers.forEach(subscriber => subscriber.onNext(frame));
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
          subscriber.onNext(this._status);
        }
      });
    });
  }

  _setConnectionStatus(status: ConnectionStatus): void {
    this._status = status;
    this._statusSubscribers.forEach(subscriber => subscriber.onNext(status));
  }
}

