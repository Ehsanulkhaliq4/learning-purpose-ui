import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { types } from 'mediasoup-client';
import type { Socket } from 'socket.io-client';

/**
 * URL of the Node.js mediasoup signaling service (services/mediasoup-service).
 * By default it points at port 3000 on the same host that served the Angular app,
 * so LAN testing works without editing the source. Deployments that expose the
 * signaling service elsewhere can define `window.__MEDIASOUP_SIGNALING_URL__`.
 */
export function resolveSignalingUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000';
  }

  const override = (
    window as unknown as { __MEDIASOUP_SIGNALING_URL__?: string }
  ).__MEDIASOUP_SIGNALING_URL__;
  if (override) {
    return override;
  }

  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const host = window.location.hostname || 'localhost';
  return `${protocol}//${host}:3000`;
}

export const MEDIASOUP_SIGNALING_URL = resolveSignalingUrl();

export type MediaKind = 'audio' | 'video';

export interface SignalingPeer {
  participantId: string;
  displayName: string;
  isHost: boolean;
  isMutedAudio: boolean;
  isMutedVideo: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  producers: Array<{
    producerId: string;
    kind: MediaKind;
    mediaType: string;
    paused: boolean;
  }>;
}

export interface SignalingChatMessage {
  id: string;
  participantId: string;
  displayName: string;
  text: string;
  timestamp: string;
}

export interface NewProducerEvent {
  producerId: string;
  participantId: string;
  displayName?: string;
  kind: MediaKind;
  mediaType: string;
}

export class SignalingError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'SignalingError';
  }
}

export interface MediasoupEvents {
  onParticipantJoined?: (participant: {
    participantId: string;
    displayName: string;
    isHost: boolean;
  }) => void;
  onParticipantLeft?: (participantId: string) => void;
  onNewProducer?: (event: NewProducerEvent) => void;
  onProducerPaused?: (event: { participantId: string; producerId: string; mediaType: string }) => void;
  onProducerResumed?: (event: { participantId: string; producerId: string; mediaType: string }) => void;
  onProducerClosed?: (event: { participantId: string; producerId: string; mediaType: string }) => void;
  onHostChanged?: (hostParticipantId: string) => void;
  onMeetingEnded?: (event: { roomId: string; reason: string; endedBy?: string }) => void;
  onActiveSpeaker?: (participantId: string | null) => void;
  onHandRaised?: (event: { participantId: string; isHandRaised: boolean }) => void;
  onChatMessage?: (message: SignalingChatMessage) => void;
  onRemoteStream?: (participantId: string, stream: MediaStream | null) => void;
  onRemoteScreenStream?: (participantId: string, stream: MediaStream | null) => void;
  onError?: (message: string) => void;
}

export interface JoinResult {
  isHost: boolean;
  hostParticipantId: string | null;
  peers: SignalingPeer[];
  chatHistory: SignalingChatMessage[];
}

@Injectable({ providedIn: 'root' })
export class MediasoupService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private socket: Socket | null = null;
  private device: types.Device | null = null;
  private sendTransport: types.Transport | null = null;
  private recvTransport: types.Transport | null = null;

  private roomId = '';
  private participantId = '';
  private displayName = '';

  private readonly localProducers = new Map<string, types.Producer>();
  private readonly remoteConsumers = new Map<
    string,
    { consumer: types.Consumer; participantId: string; mediaType: string; isScreen: boolean }
  >();
  private readonly remoteStreams = new Map<string, MediaStream>();
  private readonly remoteScreenStreams = new Map<string, MediaStream>();
  private readonly pendingProducers: NewProducerEvent[] = [];
  private readonly consumingProducers = new Set<string>();
  private events: MediasoupEvents = {};

  get isConnected(): boolean {
    return Boolean(this.socket?.connected && this.device && this.recvTransport);
  }

  get currentParticipantId(): string {
    return this.participantId;
  }

  /**
   * Full join handshake:
   * socket join-room -> load mediasoup Device -> create send/recv transports ->
   * produce local tracks -> consume every existing peer producer.
   */
  async join(options: {
    roomId: string;
    participantId: string;
    displayName: string;
    isHost: boolean;
    localStream: MediaStream | null;
    events: MediasoupEvents;
  }): Promise<JoinResult> {
    if (!this.isBrowser) {
      throw new Error('WebRTC conferencing is only available in the browser.');
    }

    this.leave();

    this.roomId = options.roomId;
    this.participantId = options.participantId;
    this.displayName = options.displayName;
    this.events = options.events;

    const [{ io }, { Device }] = await Promise.all([
      import('socket.io-client'),
      import('mediasoup-client'),
    ]);

    const socket = io(MEDIASOUP_SIGNALING_URL, {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
    });
    this.socket = socket;

    await this.waitForSocket(socket);
    this.bindSocketEvents(socket);

    const joinResponse = await this.emitAck<{
      success?: boolean;
      error?: string;
      roomId?: string;
      routerRtpCapabilities?: types.RtpCapabilities;
      isHost?: boolean;
      hostParticipantId?: string | null;
      peers?: SignalingPeer[];
      chatHistory?: SignalingChatMessage[];
    }>('join-room', {
      roomId: options.roomId,
      participantId: options.participantId,
      displayName: options.displayName,
      isHost: options.isHost,
    });

    if (!joinResponse?.success || !joinResponse.routerRtpCapabilities) {
      throw new SignalingError(
        joinResponse?.error || 'The signaling server rejected the join request.',
        (joinResponse as { code?: string } | undefined)?.code,
      );
    }

    this.roomId = joinResponse.roomId || options.roomId;

    const device = new Device();
    await device.load({ routerRtpCapabilities: joinResponse.routerRtpCapabilities });
    this.device = device;

    await this.createSendTransport();
    await this.createRecvTransport();

    if (options.localStream) {
      await this.produceLocalStream(options.localStream);
    }

    // Producers that started while the transports were being created were queued.
    const queued = this.pendingProducers.splice(0);
    for (const producer of queued) {
      await this.consumeProducer(producer).catch(() => undefined);
    }

    const peers = joinResponse.peers ?? [];

    // Consume producers that were already active before this participant joined.
    for (const peer of peers) {
      for (const producer of peer.producers ?? []) {
        if (producer.producerId) {
          await this.consumeProducer({
            producerId: producer.producerId,
            participantId: peer.participantId,
            displayName: peer.displayName,
            kind: producer.kind,
            mediaType: producer.mediaType,
          }).catch(() => undefined);
        }
      }
    }

    return {
      isHost: Boolean(joinResponse.isHost),
      hostParticipantId: joinResponse.hostParticipantId ?? null,
      peers,
      chatHistory: joinResponse.chatHistory ?? [],
    };
  }

  /**
   * Toggles the local microphone/camera producer and informs the SFU so that
   * every remote consumer sees the correct muted state.
   */
  async setLocalProducerEnabled(kind: MediaKind, enabled: boolean): Promise<void> {
    const key = kind === 'audio' ? 'mic' : 'camera';
    const producer = this.localProducers.get(key);
    if (!producer || producer.closed) {
      return;
    }

    if (enabled) {
      await producer.resume();
    } else {
      await producer.pause();
    }

    await this.emitAck(enabled ? 'producer-resume' : 'producer-pause', {
      roomId: this.roomId,
      participantId: this.participantId,
      producerId: producer.id,
    });
  }

  async startScreenShare(stream: MediaStream): Promise<void> {
    const [track] = stream.getVideoTracks();
    if (!track || !this.sendTransport) {
      return;
    }

    const existing = this.localProducers.get('screen');
    if (existing && !existing.closed) {
      await existing.replaceTrack({ track });
      return;
    }

    const producer = await this.sendTransport.produce({
      track,
      appData: { mediaType: 'screen' },
    });
    this.localProducers.set('screen', producer);
  }

  async stopScreenShare(): Promise<void> {
    const producer = this.localProducers.get('screen');
    if (!producer) {
      return;
    }

    this.localProducers.delete('screen');

    try {
      await this.emitAck('producer-close', {
        roomId: this.roomId,
        participantId: this.participantId,
        producerId: producer.id,
      });
    } finally {
      try {
        producer.close();
      } catch {
        // ignore
      }
    }
  }

  async sendChatMessage(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    await this.emitAck('send-chat-message', {
      roomId: this.roomId,
      participantId: this.participantId,
      displayName: this.displayName,
      text: trimmed,
    });
  }

  async setHandRaised(isHandRaised: boolean): Promise<void> {
    await this.emitAck('toggle-hand-raise', {
      roomId: this.roomId,
      participantId: this.participantId,
      isHandRaised,
    });
  }

  /** Ends the meeting for every participant (host only). */
  async endMeeting(): Promise<void> {
    const response = await this.emitAck<{ success?: boolean; error?: string }>('end-meeting', {
      roomId: this.roomId,
      participantId: this.participantId,
    });

    if (response?.error) {
      throw new Error(response.error);
    }
  }

  leave(): void {
    for (const producer of this.localProducers.values()) {
      try {
        producer.close();
      } catch {
        // ignore
      }
    }
    this.localProducers.clear();

    for (const { consumer } of this.remoteConsumers.values()) {
      try {
        consumer.close();
      } catch {
        // ignore
      }
    }
    this.remoteConsumers.clear();
    this.remoteStreams.clear();
    this.remoteScreenStreams.clear();
    this.pendingProducers.length = 0;
    this.consumingProducers.clear();

    try {
      this.sendTransport?.close();
    } catch {
      // ignore
    }
    try {
      this.recvTransport?.close();
    } catch {
      // ignore
    }
    this.sendTransport = null;
    this.recvTransport = null;

    if (this.socket) {
      try {
        this.socket.emit('leave-room');
      } catch {
        // ignore
      }
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.device = null;
    this.roomId = '';
    this.participantId = '';
    this.displayName = '';
    this.events = {};
  }

  // ---------------------------------------------------------------------------
  // Signaling primitives
  // ---------------------------------------------------------------------------

  private waitForSocket(socket: Socket): Promise<void> {
    return new Promise((resolve, reject) => {
      if (socket.connected) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Timed out connecting to the mediasoup signaling server.'));
      }, 15000);

      const onConnect = () => {
        cleanup();
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      };
      const cleanup = () => {
        clearTimeout(timeout);
        socket.off('connect', onConnect);
        socket.off('connect_error', onError);
      };

      socket.on('connect', onConnect);
      socket.on('connect_error', onError);
    });
  }

  private emitAck<T>(event: string, payload: unknown, timeoutMs = 15000): Promise<T> {
    return new Promise<T>((resolve) => {
      const socket = this.socket;
      if (!socket || !socket.connected) {
        resolve({ error: 'Not connected to the signaling server.' } as T);
        return;
      }

      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve({ error: `Timed out waiting for '${event}'.` } as T);
        }
      }, timeoutMs);

      socket.emit(event, payload, (response: T) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(response);
      });
    });
  }

  private bindSocketEvents(socket: Socket): void {
    socket.on('participant-joined', (payload: { participantId: string; displayName: string; isHost: boolean }) => {
      this.events.onParticipantJoined?.(payload);
    });

    socket.on('participant-left', (payload: { participantId: string }) => {
      this.dropParticipant(payload.participantId);
      this.events.onParticipantLeft?.(payload.participantId);
    });

    socket.on('new-producer', async (payload: NewProducerEvent) => {
      this.events.onNewProducer?.(payload);
      if (payload.participantId === this.participantId) {
        return;
      }
      if (!this.recvTransport) {
        this.pendingProducers.push(payload);
        return;
      }
      await this.consumeProducer(payload).catch((error: Error) => {
        this.events.onError?.(`Unable to consume media: ${error.message}`);
      });
    });

    socket.on('producer-paused', (payload: { producerId: string; participantId: string }) => {
      const meta = this.remoteConsumers.get(payload.producerId);
      this.events.onProducerPaused?.({
        participantId: payload.participantId,
        producerId: payload.producerId,
        mediaType: meta?.mediaType ?? '',
      });
    });

    socket.on('producer-resumed', (payload: { producerId: string; participantId: string }) => {
      const meta = this.remoteConsumers.get(payload.producerId);
      this.events.onProducerResumed?.({
        participantId: payload.participantId,
        producerId: payload.producerId,
        mediaType: meta?.mediaType ?? '',
      });
    });

    socket.on('producer-closed', (payload: { producerId: string; participantId: string }) => {
      const meta = this.remoteConsumers.get(payload.producerId);
      this.closeRemoteProducer(payload.producerId);
      this.events.onProducerClosed?.({
        ...payload,
        mediaType: meta?.mediaType ?? '',
      });
    });

    socket.on('host-changed', (payload: { hostParticipantId: string }) => {
      this.events.onHostChanged?.(payload.hostParticipantId);
    });

    socket.on(
      'meeting-ended',
      (payload: { roomId: string; reason: string; endedBy?: string }) => {
        this.events.onMeetingEnded?.(payload);
      },
    );

    socket.on('active-speaker', (payload: { participantId: string } | null) => {
      this.events.onActiveSpeaker?.(payload?.participantId ?? null);
    });

    socket.on('hand-raised-updated', (payload: { participantId: string; isHandRaised: boolean }) => {
      this.events.onHandRaised?.(payload);
    });

    socket.on('chat-message', (payload: SignalingChatMessage) => {
      this.events.onChatMessage?.(payload);
    });

    socket.on('disconnect', () => {
      this.events.onError?.('Disconnected from the conference server.');
    });
  }

  // ---------------------------------------------------------------------------
  // mediasoup transports
  // ---------------------------------------------------------------------------

  private async createSendTransport(): Promise<void> {
    const transport = await this.createTransport('send');
    this.sendTransport = transport;

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      this.emitAck<{ success?: boolean; error?: string }>('connect-transport', {
        roomId: this.roomId,
        participantId: this.participantId,
        transportId: transport.id,
        dtlsParameters,
      })
        .then((response) => {
          if (response?.error) {
            errback(new Error(response.error));
            return;
          }
          callback();
        })
        .catch((error: Error) => errback(error));
    });

    transport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
      this.emitAck<{ id?: string; error?: string }>('produce', {
        roomId: this.roomId,
        participantId: this.participantId,
        transportId: transport.id,
        kind,
        rtpParameters,
        appData,
      })
        .then((response) => {
          if (response?.error || !response?.id) {
            errback(new Error(response?.error || 'The server did not return a producer id.'));
            return;
          }
          callback({ id: response.id });
        })
        .catch((error: Error) => errback(error));
    });
  }

  private async createRecvTransport(): Promise<void> {
    const transport = await this.createTransport('recv');
    this.recvTransport = transport;

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      this.emitAck<{ success?: boolean; error?: string }>('connect-transport', {
        roomId: this.roomId,
        participantId: this.participantId,
        transportId: transport.id,
        dtlsParameters,
      })
        .then((response) => {
          if (response?.error) {
            errback(new Error(response.error));
            return;
          }
          callback();
        })
        .catch((error: Error) => errback(error));
    });
  }

  private async createTransport(direction: 'send' | 'recv'): Promise<types.Transport> {
    const response = await this.emitAck<{
      error?: string;
      params?: {
        id: string;
        direction: string;
        iceParameters: types.IceParameters;
        iceCandidates: types.IceCandidate[];
        dtlsParameters: types.DtlsParameters;
      };
    }>('create-webrtc-transport', {
      roomId: this.roomId,
      participantId: this.participantId,
      direction,
    });

    if (response?.error || !response?.params) {
      throw new Error(response?.error || `Could not create the ${direction} transport.`);
    }

    const options = {
      id: response.params.id,
      iceParameters: response.params.iceParameters,
      iceCandidates: response.params.iceCandidates,
      dtlsParameters: response.params.dtlsParameters,
    };

    if (direction === 'send') {
      return this.device!.createSendTransport(options);
    }
    return this.device!.createRecvTransport(options);
  }

  private async produceLocalStream(stream: MediaStream): Promise<void> {
    const [audioTrack] = stream.getAudioTracks();
    const [videoTrack] = stream.getVideoTracks();

    if (audioTrack) {
      const producer = await this.sendTransport!.produce({
        track: audioTrack,
        appData: { mediaType: 'mic' },
      });
      this.localProducers.set('mic', producer);
    }

    if (videoTrack) {
      const producer = await this.sendTransport!.produce({
        track: videoTrack,
        appData: { mediaType: 'camera' },
      });
      this.localProducers.set('camera', producer);
    }
  }

  // ---------------------------------------------------------------------------
  // Remote consumers
  // ---------------------------------------------------------------------------

  private async consumeProducer(producer: NewProducerEvent): Promise<void> {
    if (!this.recvTransport || !this.device) {
      return;
    }
    if (
      this.remoteConsumers.has(producer.producerId) ||
      this.consumingProducers.has(producer.producerId)
    ) {
      return;
    }

    this.consumingProducers.add(producer.producerId);

    try {
      await this.createConsumer(producer);
    } finally {
      this.consumingProducers.delete(producer.producerId);
    }
  }

  private async createConsumer(producer: NewProducerEvent): Promise<void> {
    const recvTransport = this.recvTransport;
    const device = this.device;
    if (!recvTransport || !device) {
      return;
    }

    const response = await this.emitAck<{
      error?: string;
      params?: {
        id: string;
        producerId: string;
        kind: MediaKind;
        rtpParameters: types.RtpParameters;
        type: string;
        producerPaused: boolean;
        appData: Record<string, unknown>;
      };
    }>('consume', {
      roomId: this.roomId,
      participantId: this.participantId,
      transportId: recvTransport.id,
      producerId: producer.producerId,
      rtpCapabilities: device.rtpCapabilities,
    });

    if (response?.error || !response?.params) {
      throw new Error(response?.error || `Could not consume producer ${producer.producerId}.`);
    }

    const params = response.params;
    const consumer = await recvTransport.consume({
      id: params.id,
      producerId: params.producerId,
      kind: params.kind,
      rtpParameters: params.rtpParameters,
      appData: params.appData,
    });

    const mediaType = producer.mediaType || params.kind;
    const isScreen = mediaType.toLowerCase() === 'screen';
    const streamMap = isScreen ? this.remoteScreenStreams : this.remoteStreams;

    this.remoteConsumers.set(producer.producerId, {
      consumer,
      participantId: producer.participantId,
      mediaType,
      isScreen,
    });

    let stream = streamMap.get(producer.participantId);
    if (!stream) {
      stream = new MediaStream();
      streamMap.set(producer.participantId, stream);
    }
    stream.addTrack(consumer.track);
    this.emitRemoteStream(producer.participantId, stream, isScreen);

    consumer.on('trackended', () => {
      const current = streamMap.get(producer.participantId);
      if (current) {
        try {
          current.removeTrack(consumer.track);
        } catch {
          // ignore
        }
        this.emitRemoteStream(producer.participantId, current, isScreen);
      }
    });

    consumer.on('transportclose', () => {
      this.closeRemoteProducer(producer.producerId);
    });

    await this.emitAck('consumer-resume', {
      roomId: this.roomId,
      participantId: this.participantId,
      consumerId: consumer.id,
    });
  }

  private closeRemoteProducer(producerId: string): void {
    const entry = this.remoteConsumers.get(producerId);
    if (!entry) {
      return;
    }

    this.remoteConsumers.delete(producerId);

    const streamMap = entry.isScreen ? this.remoteScreenStreams : this.remoteStreams;
    const stream = streamMap.get(entry.participantId);
    if (stream) {
      try {
        stream.removeTrack(entry.consumer.track);
      } catch {
        // ignore
      }
      this.emitRemoteStream(entry.participantId, stream, entry.isScreen);
    }

    try {
      entry.consumer.close();
    } catch {
      // ignore
    }
  }

  private emitRemoteStream(participantId: string, stream: MediaStream, isScreen: boolean): void {
    if (isScreen) {
      this.events.onRemoteScreenStream?.(participantId, stream);
    } else {
      this.events.onRemoteStream?.(participantId, stream);
    }
  }

  private dropParticipant(participantId: string): void {
    for (let index = this.pendingProducers.length - 1; index >= 0; index -= 1) {
      if (this.pendingProducers[index].participantId === participantId) {
        this.pendingProducers.splice(index, 1);
      }
    }

    for (const [producerId, entry] of this.remoteConsumers.entries()) {
      if (entry.participantId === participantId) {
        this.closeRemoteProducer(producerId);
      }
    }

    if (this.remoteStreams.delete(participantId)) {
      this.events.onRemoteStream?.(participantId, null);
    }
    if (this.remoteScreenStreams.delete(participantId)) {
      this.events.onRemoteScreenStream?.(participantId, null);
    }
  }
}
