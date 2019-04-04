import type {Connect} from "../../rsocket-events-client/src/Connect";

class EventsServer {
    constructor(option){
        this.eventType = option.eventType || "defaultEventsListener";
        this.address = option.address;
        this._getEventData = option.processEvent || (e => e.details);
        addEventListener(this.eventType, this._handler);

    }
    _handler(e){
        const event = this._getEventData(e);


        if( event.address !== this.address && event.type === "open" ){
            return;
        }
        const clientChannelPort = e.ports[0]; // serverChannel.port1
        clientChannelPort.postMessage({type: "connect"});
        const eventClient: Connect = {
            connect: () => {
                return {
                    send: (msg) => {
                        const message = {
                            type: "response",
                            cid: Date.now() + "-" + Math.random(),
                            payload: msg
                        }
                        clientChannelPort.postMessage(message);
                    },
                    receive: (cb) => {
                        listeners.push(clientChannelPort.addEventListener("message", (e) => e.type === "request" && cb(e.payload)));
                    },
                    disconnect: () => {
                        const message = {
                            type: "disconnect",
                            cid: Date.now() + "-" + Math.random(),
                            payload: null
                        }
                        clientChannelPort.postMessage(message);
                    }
                }
            }
        };

        clientChannelPort.addEventListener("message", (msg) => {
           switch (msg.type) {
               case "close": {
                   clientChannel.postMessage({type: "disconnect"});
                   clientChannelPort.close();
               }
           }
        });
        clientChannelPort.start();
        this._onConnection(eventClient);
    }
    onConnect(cb){
        this._onConnection = cb;
    }
}
