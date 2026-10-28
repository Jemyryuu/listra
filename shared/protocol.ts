export const PROTOCOL_VERSION = 1;

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

export interface PingMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'ping';
  t1: number;
}

export interface PongMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'pong';
  t1: number;
  t2: number;
  t3: number;
}

export type ClockChannelMessage = PingMessage | PongMessage;

export interface StateHeartbeatMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'state';
  seq: number;
  uri: string;
  positionMs: number;
  atHostTime: number;
  isPlaying: boolean;
}

export interface ScheduleActionMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'schedule';
  seq: number;
  action: 'play' | 'pause' | 'seek' | 'load';
  uri?: string;
  positionMs?: number;
  executeAtHostTime: number;
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
