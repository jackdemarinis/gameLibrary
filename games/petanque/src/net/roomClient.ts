// The one place that knows the room server's URL and wire format.
// Server side: app/routers/rooms.py.

export interface RoomMember {
  clientId: string;
  name: string;
}

export type ServerMessage =
  | { type: "joined"; code: string; game: string; clientId: string; hostId: string; members: RoomMember[] }
  | { type: "memberJoined"; member: RoomMember }
  | { type: "memberLeft"; clientId: string }
  | { type: "roomClosed"; reason: string }
  | { type: "relay"; from: string; payload: unknown }
  | { type: "error"; error: { code: string; message: string } };

export type JoinedMessage = Extract<ServerMessage, { type: "joined" }>;

const gameId = "petanque";

function socketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/rooms`;
}

const connectTimeoutMs = 8000;
const unreachableMessage =
  "Couldn't reach the room server. Online play needs the JackGames server running (uvicorn app.main:app) — open the game from that server's address.";

export class RoomClient {
  private socket: WebSocket | null = null;
  private listener: (message: ServerMessage) => void = () => {};
  private closeListener: () => void = () => {};
  private closedOnPurpose = false;

  onMessage(listener: (message: ServerMessage) => void): void {
    this.listener = listener;
  }

  onClose(listener: () => void): void {
    this.closeListener = listener;
  }

  get isOpen(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  // Connects, sends create/join, and resolves with the server's `joined` reply.
  enter(request: { create: true; name: string } | { create: false; name: string; code: string }): Promise<JoinedMessage> {
    this.close();
    this.closedOnPurpose = false;
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(socketUrl());
      this.socket = socket;
      let settled = false;
      // A socket that never opens (server down behind a proxy) shouldn't hang the menu.
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(unreachableMessage));
        socket.close();
      }, connectTimeoutMs);

      socket.addEventListener("open", () => {
        socket.send(
          JSON.stringify(
            request.create
              ? { type: "create", game: gameId, name: request.name }
              : { type: "join", game: gameId, name: request.name, code: request.code },
          ),
        );
      });

      socket.addEventListener("message", (event) => {
        let message: ServerMessage;
        try {
          message = JSON.parse(String(event.data)) as ServerMessage;
        } catch {
          return;
        }
        if (!settled) {
          if (message.type === "joined") {
            settled = true;
            window.clearTimeout(timeout);
            resolve(message);
          } else if (message.type === "error") {
            settled = true;
            window.clearTimeout(timeout);
            reject(new Error(message.error.message));
            this.close();
          }
          return;
        }
        this.listener(message);
      });

      socket.addEventListener("close", () => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timeout);
          reject(new Error(unreachableMessage));
          return;
        }
        if (this.socket === socket) this.socket = null;
        if (!this.closedOnPurpose) this.closeListener();
      });
    });
  }

  relay(payload: unknown, to?: string): void {
    this.send({ type: "relay", payload, ...(to ? { to } : {}) });
  }

  lock(locked: boolean): void {
    this.send({ type: "lock", locked });
  }

  close(): void {
    this.closedOnPurpose = true;
    this.socket?.close();
    this.socket = null;
  }

  private send(message: object): void {
    if (this.isOpen) this.socket!.send(JSON.stringify(message));
  }
}
