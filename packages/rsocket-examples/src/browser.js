import RSocketEventsClient from 'rsocket-events-client';

import { RSocketClient } from "rsocket-core";
import { Flowable, Single } from "rsocket-flowable";

class SymmetricResponder {
  fireAndForget(payload) {
    logRequest('fnf', payload);
  }

  requestResponse(payload){
    logRequest('requestResponse', payload);
    return Single.error(new Error());
  }

  requestStream(payload) {
    logRequest('requestStream', payload);
    return Flowable.just(make('Hello '), make('world!'));
  }

  requestChannel(payloads){
    return Flowable.error(new Error());
  }

  metadataPush(payload){
    logRequest('metadataPush', payload);
    return Single.error(new Error());
  }
}

const client = new RSocketClient({
  setup: {
    dataMimeType: 'text/plain',
    keepAlive: 1000000, // avoid sending during test
    lifetime: 100000,
    metadataMimeType: 'text/plain',
  },
  responder: new SymmetricResponder(),
  transport: RSocketEventsClient('pm' , {address : 'pm://host/path:80', }),
});
client.connect();


console.log('test');




function logRequest( type, payload, side) {
  console.log(
    `${side} got ${type} with payload: data: ${payload.data || 'null'},
      metadata: ${payload.metadata || 'null'}`,
  );
}


function make(data) {
  return {
    data,
    metadata: '',
  };
}
