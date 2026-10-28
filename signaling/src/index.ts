export interface Env {
  ROOMS: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/room/')) {
      const roomId = url.pathname.split('/')[2]?.toUpperCase();
      if (!roomId || !/^[A-Z0-9]{6}$/.test(roomId)) {
        return new Response('Invalid Room ID', { status: 400 });
      }

      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
      }

      const id = env.ROOMS.idFromName(roomId);
      const roomObject = env.ROOMS.get(id);
      return roomObject.fetch(request);
    }

    return new Response('Listra Signaling Worker', { status: 200 });
  },
};

export class RoomDurableObject {
  private state: DurableObjectState;
  private sessions: WebSocket[] = [];

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.state.acceptWebSocket(server);
    this.sessions.push(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    for (const session of this.sessions) {
      if (session !== ws && session.readyState === WebSocket.OPEN) {
        session.send(message);
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.sessions = this.sessions.filter((s) => s !== ws);
  }
}
