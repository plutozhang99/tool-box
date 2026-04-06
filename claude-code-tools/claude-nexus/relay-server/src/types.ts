export interface AuthChallenge {
  readonly type: 'challenge';
  readonly nonce: string;
}

export interface AuthResponse {
  readonly type: 'auth';
  readonly peer_id: string;
  readonly signature: string;
  readonly public_key: string;
}

export interface RelayPayload {
  readonly nonce: string;
  readonly ciphertext: string;
}

export interface RelayMessage {
  readonly type: 'relay';
  readonly from: string;
  readonly to: string;
  readonly payload: RelayPayload;
  readonly message_id?: string;
}

export interface Ack {
  readonly type: 'ack';
  readonly message_id?: string;
}

export interface RelayError {
  readonly type: 'error';
  readonly message: string;
}

export interface QueuedNotice {
  readonly type: 'queued';
  readonly message_id: string;
  readonly to: string;
}

export type IncomingMessage = AuthResponse | RelayMessage;
export type OutgoingMessage = AuthChallenge | Ack | RelayError | RelayMessage | QueuedNotice;

export interface ConnectedPeer {
  readonly peerId: string;
  readonly publicKey: string;
  readonly connectedAt: string;
  send: (msg: OutgoingMessage) => void;
}
