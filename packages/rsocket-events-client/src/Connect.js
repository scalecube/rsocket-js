export interface Connection {
    send(msg: Object): void;
    receive(cb: function): void;
    disconnect(): void;
}
export interface Connect {
    connect(address:? string): Connection;
}