/**
 * Shared message protocol for Listen Together
 * Version 1
 */

export const PROTOCOL_VERSION = 1;

// --- Extension <-> Daemon (Local WebSocket on 127.0.0.1:8989) ---

export interface DaemonHelloMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'hello';
  token: string;
  clientVersion: string;
}

export interface DaemonPresenceSetMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'presence.set';
  roomId: string;
  trackName: string;
  artist: string;
  albumArtUrl?: string;
  trackUri: string;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
}

export interface DaemonPresenceClearMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'presence.clear';
}

export interface DaemonJoinRequestMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'join.request';
  roomId: string;
}

export type ExtensionToDaemonMessage =
  | DaemonHelloMessage
  | DaemonPresenceSetMessage
  | DaemonPresenceClearMessage;

export type DaemonToExtensionMessage = DaemonJoinRequestMessage;

// --- Peer <-> Peer (WebRTC DataChannels) ---

/**
 * Clock Channel (Unreliable, Unordered UDP)
 */
export interface PingMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'ping';
  t1: number; // Host or client local monotonic timestamp (performance.now())
}

export interface PongMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'pong';
  t1: number; // Original t1 from ping
  t2: number; // Receive timestamp on remote peer
  t3: number; // Send timestamp on remote peer
}

export type ClockChannelMessage = PingMessage | PongMessage;

/**
 * Control Channel (Reliable, Ordered)
 */
export interface StateHeartbeatMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'state';
  seq: number;
  uri: string;
  positionMs: number;
  atHostTime: number; // Host's virtual master clock time
  isPlaying: boolean;
}

export interface ScheduleActionMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'schedule';
  seq: number;
  action: 'play' | 'pause' | 'seek' | 'load';
  uri?: string;
  positionMs?: number;
  executeAtHostTime: number; // Virtual master clock execution timestamp
}

export interface PrefetchMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'prefetch';
  uri: string;
}

export interface ReadyMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'ready';
  seq: number;
}

export interface MemberJoinMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'member.join';
  id: string;
  name: string;
  image?: string;
}

export interface MemberLeaveMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'member.leave';
  id: string;
}

export type ControlChannelMessage =
  | StateHeartbeatMessage
  | ScheduleActionMessage
  | PrefetchMessage
  | ReadyMessage
  | MemberJoinMessage
  | MemberLeaveMessage;
