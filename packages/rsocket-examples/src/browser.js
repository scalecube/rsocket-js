import RSocketEventsClient from "rsocket-events-client";
import RSocketEventsServer from "rsocket-events-server";

import { MAX_STREAM_ID, RSocketClient, RSocketServer } from "rsocket-core";
import { Flowable, Single } from "rsocket-flowable";

class SymmetricResponder {
  fireAndForget(payload) {
    logRequest("fnf", payload);
  }

  requestResponse(payload) {
    logRequest("requestResponse", payload);
    return Single.of(make(`${ payload.data } response`));
  }

  requestStream(payload) {
    logRequest("requestStream", payload);
    return Flowable.just(make(`${ payload.data } stream1`), make(`${ payload.data } stream2`));
  }

  requestChannel(payloads) {
    return Flowable.error(new Error());
  }

  metadataPush(payload) {
    logRequest("metadataPush", payload);
    return Single.error(new Error());
  }
}

const protocol = "pm";
const serverOptions = {
  host: "host",
  path: "path",
  port: 80
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

const client = new RSocketClient({
  setup: {
    dataMimeType: "text/plain",
    keepAlive: 1000000, // avoid sending during test
    lifetime: 100000,
    metadataMimeType: "text/plain"
  },
  responder: data =>
    console.log(`responder ${ data }`)
  ,
  transport: new RSocketEventsClient({ address: "pm://host/path:80" })
});

client.connect(protocol, serverOptions).then((socket) => {
  pickOperation(socket, {
    operation: "requestResponse",
    payload: "requestResponse testing"
  });

  pickOperation(socket, {
    operation: "requestStream",
    payload: "requestStream testing"
  });
});

function pickOperation(socket, { operation, payload }) {
  console.log(`Requesting ${ operation } with payload: ${ payload }`);
  switch ( operation ) {
    case "none":
      return Flowable.never();
    case "requestResponse":
      return socket.requestResponse({
        data: payload,
        metadata: ""
      }).then(({ data, metadata }) =>
        console.log(`response ${ data }`)
      );
    case "requestStream":
      return socket.requestStream({
        data: payload,
        metadata: ""
      }).subscribe(observer);
    default:
      return null;
  }
}

const observer = {
  onComplete() {
    console.log("onComplete()");
  },
  onError(error) {
    console.log("onError(%s)", error.message);
  },
  onNext(payload) {
    console.log("onNext(%s)", payload.data);
  },
  onSubscribe(_subscription) {
    _subscription.request(MAX_STREAM_ID);
  }
};

function logRequest(type, payload) {
  console.log(
    `${ type } with payload: data: ${ payload.data || "null" },
      metadata: ${ payload.metadata || "null" }`
  );
}


function make(data) {
  return {
    data,
    metadata: ""
  };
}
