import type {Connect} from "./Connect";

class EventsClient implements Connect{
    constructor(option){
        this.eventType = option.eventType || "defaultEventsListener";
    }
    connect(address) {
        let channel = new MessageChannel();
        const listeners = [];

        dispatchEvent(new CustomEvent({address, type: "open"}, channel.port2));
        listeners.push(channel.port1.addEventListener("message", (msg) => {
            switch (msg.type) {
                case "connect": {
                    break;
                }
                case "disconnect": {
                    channel.close();
                    listeners.forEach((l) => channel.removeEventListener("message", l));
                    channel = null;
                    break;
                }
            }
        }));


        return Object.freeze({
            send: (msg) => {
                const message = {
                    type: "request",
                    cid: Date.now() + "-" + Math.random(),
                    payload: msg
                }
                channel.port1.postMessage(message);
            },
            receive: (cb) => {
                listeners.push(channel.port1.addEventListener("message", (e) => e.type === "response" && cb(e.payload)));
            },
            disconnect: () => {
                const message = {
                    type: "close",
                    cid: Date.now() + "-" + Math.random(),
                    payload: null
                }
                channel.port1.postMessage(message);
            }
        });
    }

}
