
const { MessageChannel } = require('worker_threads');
global.MessageChannel = MessageChannel;

describe("event test", () => {
  test("dom", ()=>{
    console.error('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>11111111');
      const element = document.createElement('div');
      element.id = 'div';
      console.warn('test1212121', element.id, MessageChannel );
      expect(true).toBe(true);
  });

/*
  test("events", (done) => {

    class SymmetricResponder {
      fireAndForget(payload) {
        logRequest("fnf", payload);
      }

      requestResponse(payload) {
        logRequest("requestResponse", payload);
        return Single.error(new Error());
      }

      requestStream(payload) {
        logRequest("requestStream", payload);
        return Flowable.just(make("Hello "), make("world!"));
      }

      requestChannel(payloads) {
        return Flowable.error(new Error());
      }

      metadataPush(payload) {
        logRequest("metadataPush", payload);
        return Single.error(new Error());
      }
    }


    const server = new RSocketServer({
      getRequestHandler: socket => {
        console.log("socket", socket);
        return new SymmetricResponder();
      },
      transport: new RSocketEventsServer({
        host: "host",
        path: "path",
        port: 80
      })
    });
    server.start();


    const t = new RSocketEventsClient({ address: "pm://host/path:80" });
    const client = new RSocketClient({
      setup: {
        dataMimeType: "text/plain",
        keepAlive: 1000000, // avoid sending during test
        lifetime: 100000,
        metadataMimeType: "text/plain"
      },
      responder: new SymmetricResponder(),
      transport: t
    });

    const connect = client.connect();

    connect.subscribe(data => console.log('connect.subscribe', data));
    t.connect();

    console.log("test");


    setTimeout(() => {
      console.log("done");
      done();
    }, 3000);

    function logRequest(type, payload, side) {
      console.log(
        `${ side } got ${ type } with payload: data: ${ payload.data || "null" },
      metadata: ${ payload.metadata || "null" }`
      );
    }


    function make(data) {
      return {
        data,
        metadata: ""
      };
    }
  });*/
});
