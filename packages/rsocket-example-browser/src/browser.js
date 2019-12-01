import RSocketEventsClient from 'rsocket-events-client';
import RSocketEventsServer from 'rsocket-events-server';

// import { MAX_STREAM_ID, RSocketClient, RSocketServer } from 'rsocket-core';

import RSocketClient from 'rsocket-core/build/RSocketClient';
import RSocketServer from 'rsocket-core/build/RSocketServer';
import { MAX_STREAM_ID } from 'rsocket-core/build/RSocketFrame';

import { Flowable, Single, FlowableProcessor } from 'rsocket-flowable';



const serverStop = (function serverSide() {
  const serverOptions = {
    address: 'pm://host/path:80',
    debug: true
  };

  const server = new RSocketServer({
    getRequestHandler: socket => {
      // runOperation(socket, {
      //   operation: "stream",
      //   payload: "server test payload"
      // });
      return new SymmetricResponder();
    },
    transport: new RSocketEventsServer(serverOptions)
  });
  server.start();
  return server.stop.bind(server);
})();

(function clientSide(clientOptions) {
  const client = new RSocketClient({
    setup: {
      dataMimeType: 'text/plain',
      keepAlive: 1000000, // avoid sending during test
      lifetime: 100000,
      metadataMimeType: 'text/plain'
    },
    // responder: data =>
    //   console.log(`responder ${ data }`)
    // ,
    transport: new RSocketEventsClient(clientOptions)
  });

  client.connect().then(socket => {
    // pickOperation(socket, {
    //   operation: 'requestResponse',
    //   payload: 'requestResponse testing'
    // });
    // serverStop();
    // client.close();
    pickOperation(socket, {
      operation: 'requestStream',
      payload: 'requestStream testing'
    });
    // serverStop();
    // client.close();
  });

  function pickOperation(socket, { operation, payload }) {
    console.log(`Requesting ${ operation } with payload: ${ payload }`);
    switch ( operation ) {
      case 'none':
        return Flowable.never();
      case 'requestResponse':
        return socket
          .requestResponse({
            data: payload,
            metadata: ''
          })
          .subscribe(observer);
      case 'requestStream':
        return socket
          .requestStream({
            data: payload,
            metadata: ''
          })
          .subscribe(observerFlow);
      default:
        return null;
    }
  }
})({ address: 'pm://host/path:80', debug: true });


const observer = {
  onComplete() {
    console.log('onComplete()');
  },
  onError(error) {
    console.log('onError(%s)', error.source.message);
  }

};

const observerFlow = {
  ...observer,
  onNext(payload) {
    console.log('onNext(%s)', payload.data);
  },
  onSubscribe(_subscription) {
    _subscription.request(MAX_STREAM_ID);
  }
};

const flowable = new Flowable(subscriber => {
  subscriber.onSubscribe();
})
// const subject = new FlowableProcessor(flowable, (nextVal)=>nextVal);
// const subject = new FlowableProcessor(Flowable.just(), (nextVal) => nextVal);
const subject = new FlowableProcessor(Flowable.never(), (nextVal) => nextVal);

subject.subscribe(observerFlow);

subject.onNext({data: '111111'})

class SymmetricResponder {
  fireAndForget(payload) {
    logRequest('fnf', payload);
  }

  requestResponse(payload) {
    logRequest('requestResponse', payload);
    // return Single.error(errorFactory({ data: 'requestResponse error test' }));
    // return Single.error('requestResponse error test');

    return Single.of(make(`${payload.data} response`));
  }

  requestStream(payload) {
    logRequest('requestStream', payload);
    // const flowable = new Flowable();
    // return flowable.onNext({ data: 'requestStream error test' })
    // return Flowable.error(errorFactory({ data: 'requestStream error test' }));
    return new Flowable((subscriber) => {
      subscriber.onSubscribe();
      subscriber.onError({message : new Error('test')})
    });

    // return Flowable.just(
    //   make(`${payload.data} stream1`),
    //   make(`${payload.data} stream2`),
    // );
  }

  requestChannel(payloads) {
    return Flowable.error(new Error());
  }

  metadataPush(payload) {
    logRequest('metadataPush', payload);
    return Single.error(new Error());
  }
}

function logRequest(type, payload) {
  console.log(
    `${ type } with payload: data: ${ payload.data || 'null' },
      metadata: ${ payload.metadata || 'null' }`
  );
}

function errorFactory(err) {
  return {
    message: err
  };
}

function make(data) {
  return {
    data,
    metadata: ''
  };
}
