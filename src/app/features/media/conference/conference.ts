import {
  Component,
  computed,
  inject,
  signal,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { AuthService } from '../../../core/services/auth.service';
import { MediaService } from '../../../core/services/media.service';
import {
  MediasoupService,
  SignalingError,
  type MediasoupEvents,
  type SignalingChatMessage,
  type SignalingPeer,
} from '../../../core/services/mediasoup.service';

export interface ConferenceParticipant {
  id: string;
  name: string;
  role: string;
  muted: boolean;
  videoOn: boolean;
  speaking: boolean;
  avatar: string;
  color?: string;
  handRaised?: boolean;
  isHost?: boolean;
  isSelf?: boolean;
  avatarBg?: string;
}

export interface FloatingReaction {
  id: number;
  emoji: string;
  x: number;
  sender: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  time: string;
  text: string;
  isSelf: boolean;
  avatar: string;
}

interface RemoteScreenShare {
  participantId: string;
  name: string;
  stream: MediaStream;
}

const EMPTY_PARTICIPANT: ConferenceParticipant = {
  id: '',
  name: 'Participant',
  role: 'Participant',
  muted: true,
  videoOn: false,
  speaking: false,
  avatar: 'P',
  isHost: false,
  isSelf: false,
};

@Component({
  selector: 'app-conference-room',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './conference.html',
  styleUrl: './conference.css',
})
export class ConferenceRoomPage implements OnInit, OnDestroy {
  private readonly mediaService = inject(MediaService);
  private readonly authService = inject(AuthService);
  private readonly mediasoup = inject(MediasoupService);
  private readonly route = inject(ActivatedRoute);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly roomId = signal('meet-' + Math.random().toString(36).substring(2, 8));
  readonly defaultUserId = computed(() => this.authService.currentUser()?.username ?? 'Guest User');
  readonly customUserName = signal('');
  readonly effectiveUserName = computed(() => this.customUserName().trim() || this.defaultUserId());
  readonly roomTitle = signal('Quarterly Strategy & Product Sync');

  // Meeting state
  readonly isJoined = signal(false);
  readonly isConnecting = signal(false);
  readonly isStartingMedia = signal(false);
  readonly isMuted = signal(false);
  readonly isVideoOn = signal(true);
  readonly isScreenSharing = signal(false);
  readonly isHandRaised = signal(false);
  readonly isRecording = signal(true);
  readonly isCaptionsOn = signal(false);
  readonly isFullscreen = signal(false);
  readonly errorMessage = signal<string | null>(null);

  // Identity / session
  readonly selfParticipantId = signal('');
  readonly isHost = signal(false);
  readonly isSelfSpeaking = signal(false);

  // Layout & Drawers
  readonly layoutMode = signal<'grid' | 'spotlight' | 'sidebar'>('grid');
  readonly activeDrawer = signal<'none' | 'chat' | 'participants' | 'info' | 'settings'>('none');
  readonly activeTab = signal<'create' | 'join'>('create');
  readonly searchParticipantQuery = signal('');
  readonly pinnedParticipantId = signal<string | null>(null);

  // Streams & Audio
  readonly localStream = signal<MediaStream | null>(null);
  readonly screenStream = signal<MediaStream | null>(null);
  readonly remoteStreams = signal<Map<string, MediaStream>>(new Map());
  readonly remoteScreenShare = signal<RemoteScreenShare | null>(null);
  readonly audioLevel = signal(0);
  readonly isMicCheckActive = signal(false);
  readonly isMicCheckStarting = signal(false);
  readonly micCheckMessage = signal('');
  readonly micBars = [0, 1, 2, 3, 4];
  private micCheckStream: MediaStream | null = null;
  private micCheckAudioContext: AudioContext | null = null;
  private micCheckAnalyser: AnalyserNode | null = null;
  private micCheckAnimationFrame = 0;

  // Timer
  readonly elapsedSeconds = signal(0);
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  // Closed Captions & Live transcript
  readonly currentCaption = signal<{ speaker: string; text: string } | null>(null);

  // Floating Reactions
  readonly floatingReactions = signal<FloatingReaction[]>([]);
  readonly quickEmojis = ['❤️', '👏', '👍', '🎉', '🔥', '😂', '🚀', '💯'];

  // Chat
  readonly newChatMessage = signal('');
  readonly unreadChatCount = signal(0);
  readonly chatMessages = signal<ChatMessage[]>([]);

  // Settings
  readonly virtualBackground = signal<'none' | 'blur' | 'modern' | 'minimal'>('blur');
  readonly noiseSuppression = signal(true);
  readonly hdVideoQuality = signal(true);
  readonly selectedMic = signal('Default - Internal Microphone');
  readonly selectedCamera = signal('FaceTime HD Camera (Built-in)');

  // Real participants, populated from the signaling server
  readonly participants = signal<ConferenceParticipant[]>([]);

  readonly filteredParticipants = computed(() => {
    const q = this.searchParticipantQuery().toLowerCase().trim();
    if (!q) return this.participants();
    return this.participants().filter(
      (p) => p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q),
    );
  });

  readonly activeSpotlight = computed(() => {
    const pinnedId = this.pinnedParticipantId();
    if (pinnedId) {
      const pinned = this.participants().find((p) => p.id === pinnedId);
      if (pinned) return pinned;
    }
    return (
      this.participants().find((p) => p.speaking) ?? this.participants()[0] ?? EMPTY_PARTICIPANT
    );
  });

  readonly formattedTimer = computed(() => {
    const total = this.elapsedSeconds();
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  });

  readonly isAnyoneScreenSharing = computed(
    () => this.isScreenSharing() || this.remoteScreenShare() !== null,
  );

  ngOnInit(): void {
    this.startTimer();

    // Support invite links of the form /conference?room=meet-abc123
    const roomFromUrl = this.route.snapshot.queryParamMap.get('room');
    if (roomFromUrl?.trim()) {
      this.roomId.set(roomFromUrl.trim());
      this.activeTab.set('join');
    }
  }

  ngOnDestroy(): void {
    this.stopTimer();
    this.stopMicCheck();
    this.mediasoup.leave();
    this.stopAllMediaTracks();
  }

  // ---------------------------------------------------------------------------
  // Device preview / microphone test
  // ---------------------------------------------------------------------------

  micBarHeight(index: number): number {
    const maximumHeights = [7, 12, 16, 10, 6];
    return Math.max(4, Math.round((maximumHeights[index] ?? 8) * this.audioLevel() / 100));
  }

  async toggleMicCheck(): Promise<void> {
    if (this.isMicCheckActive()) {
      this.stopMicCheck();
      return;
    }
    if (this.isMicCheckStarting()) return;

    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') {
      this.micCheckMessage.set('Live microphone testing is not supported in this browser.');
      return;
    }

    this.isMicCheckStarting.set(true);
    this.micCheckMessage.set('Allow microphone access to begin the test.');
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      await audioContext.resume();

      this.micCheckStream = stream;
      this.micCheckAudioContext = audioContext;
      this.micCheckAnalyser = analyser;
      this.isMicCheckActive.set(true);
      this.micCheckMessage.set('Speak to test your microphone.');
      this.updateMicLevel();
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      if (audioContext && audioContext.state !== 'closed') void audioContext.close();
      this.micCheckMessage.set('Microphone access is blocked or unavailable.');
    } finally {
      this.isMicCheckStarting.set(false);
    }
  }

  private updateMicLevel(): void {
    const analyser = this.micCheckAnalyser;
    if (!analyser || !this.isMicCheckActive()) return;

    const samples = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(samples);
    const squaredTotal = samples.reduce((total, sample) => {
      const amplitude = (sample - 128) / 128;
      return total + amplitude * amplitude;
    }, 0);
    const rootMeanSquare = Math.sqrt(squaredTotal / samples.length);
    this.audioLevel.set(Math.min(100, Math.round(rootMeanSquare * 800)));
    this.micCheckAnimationFrame = requestAnimationFrame(() => this.updateMicLevel());
  }

  private stopMicCheck(): void {
    if (this.micCheckAnimationFrame) cancelAnimationFrame(this.micCheckAnimationFrame);
    this.micCheckAnimationFrame = 0;
    this.isMicCheckActive.set(false);
    this.audioLevel.set(0);
    this.micCheckMessage.set('Microphone test stopped.');
    this.micCheckAnalyser = null;
    this.micCheckStream?.getTracks().forEach((track) => track.stop());
    this.micCheckStream = null;
    if (this.micCheckAudioContext && this.micCheckAudioContext.state !== 'closed') {
      void this.micCheckAudioContext.close();
    }
    this.micCheckAudioContext = null;
  }

  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      if (!this.isJoined()) return;
      this.elapsedSeconds.update((s) => s + 1);
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Local media
  // ---------------------------------------------------------------------------

  async startLocalMedia(): Promise<MediaStream | null> {
    const existing = this.localStream();
    if (existing && existing.getTracks().some((track) => track.readyState === 'live')) {
      return existing;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.errorMessage.set('This browser does not support microphone/camera access.');
      return null;
    }

    this.isStartingMedia.set(true);
    this.errorMessage.set(null);

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      // Camera can be missing/denied while the microphone is still usable.
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.errorMessage.set('Camera unavailable — you joined in audio-only mode.');
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          this.errorMessage.set('Microphone unavailable — you joined with camera only.');
        } catch {
          this.errorMessage.set(
            'Camera and microphone permission were denied. You can still join in view-only mode.',
          );
        }
      }
    } finally {
      this.isStartingMedia.set(false);
    }

    if (!stream) {
      this.isMuted.set(true);
      this.isVideoOn.set(false);
      return null;
    }

    this.localStream.set(stream);
    this.isVideoOn.set(stream.getVideoTracks().length > 0);
    this.isMuted.set(stream.getAudioTracks().length === 0);
    return stream;
  }

  // ---------------------------------------------------------------------------
  // Join / leave
  // ---------------------------------------------------------------------------

  async createRoom(): Promise<void> {
    if (this.isConnecting()) return;
    this.errorMessage.set(null);
    // "New Meeting" always starts a fresh room so a previous (possibly ended)
    // room code is never reused for a brand-new call.
    this.roomId.set('meet-' + Math.random().toString(36).substring(2, 8));
    await this.enterRoom(true);
  }

  async joinRoom(): Promise<void> {
    if (this.isConnecting()) return;
    if (!this.roomId().trim()) {
      this.errorMessage.set('Please enter a valid Room Code or ID.');
      return;
    }
    this.errorMessage.set(null);
    await this.enterRoom(false);
  }

  private async enterRoom(claimHost: boolean): Promise<void> {
    this.isConnecting.set(true);
    this.errorMessage.set(null);

    try {
      const stream = await this.startLocalMedia();

      // Only the person starting a meeting registers the room through the Spring
      // Boot media-streaming-service (which proxies POST /api/rooms to the Node
      // SFU). Joiners must NOT create the room: re-creating it would silently
      // resurrect a meeting that the host already ended.
      if (claimHost) {
        const roomResponse = await lastValueFrom(
          this.mediaService.createConferenceRoom(this.roomId()),
        );
        const roomError = roomResponse as unknown as { success?: boolean; error?: string };
        if (roomError?.success === false) {
          throw new Error(roomError.error || 'The conference server could not create the room.');
        }
      }

      const participantId = this.resolveParticipantId(this.roomId());
      this.selfParticipantId.set(participantId);

      const result = await this.mediasoup.join({
        roomId: this.roomId(),
        participantId,
        displayName: this.effectiveUserName(),
        isHost: claimHost,
        localStream: stream,
        events: this.buildMediasoupEvents(),
      });

      this.isHost.set(result.isHost);
      this.participants.set(this.buildInitialParticipants(result.peers, result.hostParticipantId));
      this.chatMessages.set((result.chatHistory ?? []).map((m) => this.toChatMessage(m)));
      this.isJoined.set(true);
      this.elapsedSeconds.set(0);

      // Apply the mute/camera choices the user made in the lobby.
      if (this.isMuted()) {
        await this.mediasoup.setLocalProducerEnabled('audio', false);
      }
      if (!this.isVideoOn()) {
        await this.mediasoup.setLocalProducerEnabled('video', false);
      }

      void Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `Connected to ${this.roomId()}`,
        showConfirmButton: false,
        timer: 2200,
        background: '#ffffff',
        color: '#0f172a',
      });
    } catch (error) {
      const message = this.describeJoinError(error);
      this.errorMessage.set(message);
      this.isJoined.set(false);
      this.mediasoup.leave();
      this.stopAllMediaTracks();
      this.participants.set([]);
      this.remoteStreams.set(new Map());
      this.remoteScreenShare.set(null);

      void Swal.fire({
        icon: 'error',
        title: this.isMeetingGoneError(error) ? 'Meeting not available' : 'Could not join meeting',
        text: message,
        confirmButtonColor: '#0ea5e9',
        customClass: {
          popup: 'lp-swal-popup',
          confirmButton: 'lp-swal-confirm',
        },
      });
    } finally {
      this.isConnecting.set(false);
    }
  }

  private describeJoinError(error: unknown): string {
    if (error instanceof SignalingError) {
      if (error.code === 'ROOM_NOT_FOUND') {
        return 'This meeting has ended or no longer exists. Ask the host for a new invite link.';
      }
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    // HttpErrorResponse (or any non-Error rejection) carries the backend
    // payload under `error.error`; surface it instead of a generic sentence.
    const httpError = error as {
      status?: number;
      message?: string;
      error?: { error?: string; message?: string };
    };
    if (httpError?.error?.error) return httpError.error.error;
    if (httpError?.error?.message) return httpError.error.message;
    if (httpError?.status === 0) {
      return 'Cannot reach the conference server. Check that all services are running.';
    }
    if (httpError?.message) return httpError.message;
    return 'Unable to join the conference room.';
  }

  private isMeetingGoneError(error: unknown): boolean {
    return error instanceof SignalingError && error.code === 'ROOM_NOT_FOUND';
  }

  private resolveParticipantId(roomId: string): string {
    if (!this.isBrowser) {
      return `p_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    const key = `mediasoup.participant.${roomId}`;
    let id = sessionStorage.getItem(key);
    if (!id) {
      const uuid =
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      id = `p_${uuid}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  }

  private buildInitialParticipants(
    peers: SignalingPeer[],
    hostParticipantId: string | null,
  ): ConferenceParticipant[] {
    const selfId = this.selfParticipantId();
    const local = this.localStream();
    const hostId = hostParticipantId ?? (this.isHost() ? selfId : null);

    const self: ConferenceParticipant = {
      id: selfId,
      name: this.effectiveUserName(),
      role: this.isHost() ? 'Host' : 'Participant',
      muted: this.isMuted() || !local?.getAudioTracks().length,
      videoOn: this.isVideoOn() && Boolean(local?.getVideoTracks().length),
      speaking: false,
      avatar: this.initials(this.effectiveUserName()),
      isHost: this.isHost(),
      isSelf: true,
      color: '#ffffff',
      avatarBg: '#2d3748',
    };

    const remotes = peers.map((peer) =>
      this.toParticipant(peer, peer.participantId === hostId),
    );

    return [self, ...remotes];
  }

  private toParticipant(peer: SignalingPeer, isHost: boolean): ConferenceParticipant {
    return {
      id: peer.participantId,
      name: peer.displayName || 'Guest',
      role: isHost ? 'Host' : 'Participant',
      muted: peer.isMutedAudio,
      videoOn: !peer.isMutedVideo,
      speaking: false,
      avatar: this.initials(peer.displayName),
      handRaised: peer.isHandRaised,
      isHost,
      isSelf: false,
      color: '#ffffff',
      avatarBg: '#334155',
    };
  }

  private emptyPeer(participantId: string, displayName?: string): SignalingPeer {
    return {
      participantId,
      displayName: displayName || 'Guest',
      isHost: false,
      isMutedAudio: true,
      isMutedVideo: true,
      isScreenSharing: false,
      isHandRaised: false,
      producers: [],
    };
  }

  // ---------------------------------------------------------------------------
  // Signaling event bridge
  // ---------------------------------------------------------------------------

  private buildMediasoupEvents(): MediasoupEvents {
    return {
      onParticipantJoined: (participant) => {
        if (this.participants().some((p) => p.id === participant.participantId)) {
          if (participant.isHost) {
            this.applyHost(participant.participantId);
          }
          return;
        }
        const peer = this.emptyPeer(participant.participantId, participant.displayName);
        peer.isHost = participant.isHost;
        this.participants.update((list) => [
          ...list,
          this.toParticipant(peer, participant.isHost),
        ]);
        if (participant.isHost) {
          this.applyHost(participant.participantId);
        }
      },

      onParticipantLeft: (participantId) => {
        this.participants.update((list) => list.filter((p) => p.id !== participantId));
        this.remoteStreams.update((map) => {
          const next = new Map(map);
          next.delete(participantId);
          return next;
        });
        if (this.remoteScreenShare()?.participantId === participantId) {
          this.remoteScreenShare.set(null);
        }
      },

      onNewProducer: (event) => {
        if (event.participantId === this.selfParticipantId()) {
          return;
        }
        if (!this.participants().some((p) => p.id === event.participantId)) {
          const peer = this.emptyPeer(event.participantId, event.displayName);
          this.participants.update((list) => [...list, this.toParticipant(peer, false)]);
        }
        const mediaType = (event.mediaType || event.kind).toLowerCase();
        if (mediaType === 'mic' || mediaType === 'audio') {
          this.patchParticipant(event.participantId, (p) => ({ ...p, muted: false }));
        } else if (mediaType === 'camera' || mediaType === 'video') {
          this.patchParticipant(event.participantId, (p) => ({ ...p, videoOn: true }));
        }
      },

      onProducerPaused: (event) => {
        const mediaType = (event.mediaType || '').toLowerCase();
        if (mediaType === 'mic' || mediaType === 'audio') {
          this.patchParticipant(event.participantId, (p) => ({ ...p, muted: true }));
        } else if (mediaType === 'camera' || mediaType === 'video') {
          this.patchParticipant(event.participantId, (p) => ({ ...p, videoOn: false }));
        }
      },

      onProducerResumed: (event) => {
        const mediaType = (event.mediaType || '').toLowerCase();
        if (mediaType === 'mic' || mediaType === 'audio') {
          this.patchParticipant(event.participantId, (p) => ({ ...p, muted: false }));
        } else if (mediaType === 'camera' || mediaType === 'video') {
          this.patchParticipant(event.participantId, (p) => ({ ...p, videoOn: true }));
        }
      },

      onProducerClosed: (event) => {
        const mediaType = (event.mediaType || '').toLowerCase();
        if (mediaType === 'mic' || mediaType === 'audio') {
          this.patchParticipant(event.participantId, (p) => ({ ...p, muted: true }));
        } else if (mediaType === 'camera' || mediaType === 'video') {
          this.patchParticipant(event.participantId, (p) => ({ ...p, videoOn: false }));
        }
      },

      onRemoteStream: (participantId, stream) => {
        this.remoteStreams.update((map) => {
          const next = new Map(map);
          if (stream && stream.getTracks().length > 0) {
            next.set(participantId, stream);
          } else {
            next.delete(participantId);
          }
          return next;
        });
      },

      onRemoteScreenStream: (participantId, stream) => {
        if (!stream || stream.getTracks().length === 0) {
          if (this.remoteScreenShare()?.participantId === participantId) {
            this.remoteScreenShare.set(null);
          }
          return;
        }
        const name =
          this.participants().find((p) => p.id === participantId)?.name ?? 'A participant';
        this.remoteScreenShare.set({ participantId, name, stream });
      },

      onHostChanged: (hostParticipantId) => {
        this.applyHost(hostParticipantId);
      },

      onMeetingEnded: () => {
        this.handleMeetingEnded();
      },

      onActiveSpeaker: (participantId) => {
        this.isSelfSpeaking.set(
          participantId !== null && participantId === this.selfParticipantId(),
        );
        this.participants.update((list) =>
          list.map((p) => ({ ...p, speaking: participantId !== null && p.id === participantId })),
        );
      },

      onHandRaised: (event) => {
        this.patchParticipant(event.participantId, (p) => ({
          ...p,
          handRaised: event.isHandRaised,
        }));
      },

      onChatMessage: (message) => {
        this.chatMessages.update((messages) => [...messages, this.toChatMessage(message)]);
        if (this.activeDrawer() !== 'chat') {
          this.unreadChatCount.update((count) => count + 1);
        }
      },

      onError: (message) => {
        this.errorMessage.set(message);
        if (this.isJoined()) {
          void Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'warning',
            title: message,
            showConfirmButton: false,
            timer: 3500,
            background: '#ffffff',
            color: '#0f172a',
          });
        }
      },
    };
  }

  private applyHost(hostParticipantId: string): void {
    const selfId = this.selfParticipantId();
    this.isHost.set(hostParticipantId === selfId);
    this.participants.update((list) =>
      list.map((p) => ({
        ...p,
        isHost: p.id === hostParticipantId,
        role: p.id === hostParticipantId ? 'Host' : 'Participant',
      })),
    );
  }

  private patchParticipant(
    participantId: string,
    updater: (participant: ConferenceParticipant) => ConferenceParticipant,
  ): void {
    this.participants.update((list) =>
      list.map((p) => (p.id === participantId ? updater(p) : p)),
    );
  }

  private toChatMessage(message: SignalingChatMessage): ChatMessage {
    const timestamp = message.timestamp ? new Date(message.timestamp) : new Date();
    return {
      id: message.id || `${timestamp.getTime()}_${message.participantId}`,
      sender: message.displayName || 'Guest',
      time: timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: message.text,
      isSelf: message.participantId === this.selfParticipantId(),
      avatar: this.initials(message.displayName),
    };
  }

  private initials(name: string): string {
    const parts = (name || 'Guest')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return 'G';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  // ---------------------------------------------------------------------------
  // Invite links
  // ---------------------------------------------------------------------------

  showRoomInvitePopup(): void {
    void Swal.fire({
      title: 'Meeting is Ready',
      html: `
        <div style="text-align: left; padding: 0.5rem 0;">
          <p style="color: #475569; font-size: 0.88rem; margin-bottom: 0.75rem;">
            Share this Room Code with teammates to invite them:
          </p>
          <div style="background: #f8fafc; border: 1px dashed #0ea5e9; border-radius: 10px; padding: 0.85rem; font-family: monospace; font-size: 1.15rem; font-weight: 700; color: #0369a1; display: flex; justify-content: space-between; align-items: center;">
            <span>${this.roomId()}</span>
          </div>
        </div>
      `,
      icon: 'success',
      showCancelButton: true,
      cancelButtonText: 'Dismiss',
      confirmButtonText: '📋 Copy Room Link',
      customClass: {
        popup: 'lp-swal-popup lp-conference-swal',
        title: 'lp-swal-title',
        htmlContainer: 'lp-swal-text',
        confirmButton: 'lp-swal-confirm',
        cancelButton: 'lp-swal-cancel',
      },
    }).then(async (result) => {
      if (result.isConfirmed) {
        await this.copyRoomId();
      }
    });
  }

  async copyRoomId(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.roomId());
      void Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Meeting ID copied to clipboard!',
        showConfirmButton: false,
        timer: 2000,
        background: '#ffffff',
        color: '#0f172a',
      });
    } catch {
      // Clipboard unavailable
    }
  }

  async copyMeetingLink(): Promise<void> {
    const fullUrl = `${window.location.origin}/conference?room=${encodeURIComponent(this.roomId())}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      void Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Meeting invite link copied!',
        showConfirmButton: false,
        timer: 2000,
        background: '#ffffff',
        color: '#0f172a',
      });
    } catch {
      // Clipboard unavailable
    }
  }

  // ---------------------------------------------------------------------------
  // Media controls
  // ---------------------------------------------------------------------------

  async toggleMute(): Promise<void> {
    if (!this.localStream()?.getAudioTracks().length) {
      void Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: 'No microphone available',
        showConfirmButton: false,
        timer: 2200,
        background: '#ffffff',
        color: '#0f172a',
      });
      return;
    }

    const next = !this.isMuted();
    this.isMuted.set(next);

    this.localStream()?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    this.patchParticipant(this.selfParticipantId(), (p) => ({ ...p, muted: next }));

    if (this.mediasoup.isConnected) {
      await this.mediasoup.setLocalProducerEnabled('audio', !next);
    }
  }

  async toggleVideo(): Promise<void> {
    if (!this.localStream()?.getVideoTracks().length) {
      void Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: 'No camera available',
        showConfirmButton: false,
        timer: 2200,
        background: '#ffffff',
        color: '#0f172a',
      });
      return;
    }

    const next = !this.isVideoOn();
    this.isVideoOn.set(next);

    this.localStream()?.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
    this.patchParticipant(this.selfParticipantId(), (p) => ({ ...p, videoOn: next }));

    if (this.mediasoup.isConnected) {
      await this.mediasoup.setLocalProducerEnabled('video', next);
    }
  }

  async toggleScreenShare(): Promise<void> {
    if (this.isScreenSharing()) {
      await this.stopLocalScreenShare();
      return;
    }

    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        this.errorMessage.set('Screen sharing is not supported in this browser.');
        return;
      }

      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      this.screenStream.set(display);
      this.isScreenSharing.set(true);

      const [track] = display.getVideoTracks();
      if (track) {
        track.onended = () => {
          void this.stopLocalScreenShare();
        };
      }

      if (this.mediasoup.isConnected) {
        await this.mediasoup.startScreenShare(display);
      }
    } catch {
      // User cancelled the screen picker
      this.isScreenSharing.set(false);
      this.screenStream.set(null);
    }
  }

  private async stopLocalScreenShare(): Promise<void> {
    await this.mediasoup.stopScreenShare();
    this.screenStream()?.getTracks().forEach((track) => track.stop());
    this.screenStream.set(null);
    this.isScreenSharing.set(false);
  }

  async toggleHandRaise(): Promise<void> {
    const next = !this.isHandRaised();
    this.isHandRaised.set(next);
    this.patchParticipant(this.selfParticipantId(), (p) => ({ ...p, handRaised: next }));

    if (this.mediasoup.isConnected) {
      await this.mediasoup.setHandRaised(next);
    }
    if (next) {
      this.triggerReaction('✋');
    }
  }

  toggleRecording(): void {
    this.isRecording.update((val) => !val);
    void Swal.fire({
      toast: true,
      position: 'top-end',
      icon: this.isRecording() ? 'info' : 'warning',
      title: this.isRecording() ? 'Recording started (Cloud MP4)' : 'Recording paused',
      showConfirmButton: false,
      timer: 2000,
      background: '#ffffff',
      color: '#0f172a',
    });
  }

  toggleCaptions(): void {
    this.isCaptionsOn.update((val) => !val);
    if (this.isCaptionsOn()) {
      this.currentCaption.set({
        speaker: this.isHost() ? 'You' : 'Participant',
        text: 'Live captions are enabled for this meeting.',
      });
    } else {
      this.currentCaption.set(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Reactions / chat
  // ---------------------------------------------------------------------------

  triggerReaction(emoji: string): void {
    const id = Date.now() + Math.random();
    const x = Math.floor(Math.random() * 60) + 20;
    const reaction: FloatingReaction = {
      id,
      emoji,
      x,
      sender: this.effectiveUserName(),
    };

    this.floatingReactions.update((current) => [...current, reaction]);

    setTimeout(() => {
      this.floatingReactions.update((current) => current.filter((r) => r.id !== id));
    }, 2400);
  }

  async sendChatMessage(): Promise<void> {
    const text = this.newChatMessage().trim();
    if (!text) return;

    this.newChatMessage.set('');

    if (!this.mediasoup.isConnected) {
      return;
    }

    try {
      await this.mediasoup.sendChatMessage(text);
    } catch {
      this.errorMessage.set('Your message could not be sent.');
    }
  }

  // ---------------------------------------------------------------------------
  // Layout / drawers
  // ---------------------------------------------------------------------------

  toggleDrawer(drawer: 'chat' | 'participants' | 'info' | 'settings'): void {
    if (this.activeDrawer() === drawer) {
      this.activeDrawer.set('none');
    } else {
      this.activeDrawer.set(drawer);
      if (drawer === 'chat') {
        this.unreadChatCount.set(0);
      }
    }
  }

  closeDrawer(): void {
    this.activeDrawer.set('none');
  }

  setLayout(mode: 'grid' | 'spotlight' | 'sidebar'): void {
    this.layoutMode.set(mode);
  }

  pinParticipant(id: string): void {
    if (this.pinnedParticipantId() === id) {
      this.pinnedParticipantId.set(null);
    } else {
      this.pinnedParticipantId.set(id);
      this.layoutMode.set('spotlight');
    }
  }

  toggleParticipantMute(id: string): void {
    if (id === this.selfParticipantId()) {
      void this.toggleMute();
      return;
    }

    void Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'info',
      title: 'Participants control their own microphone',
      showConfirmButton: false,
      timer: 2500,
      background: '#ffffff',
      color: '#0f172a',
    });
  }

  muteAllParticipants(): void {
    void Swal.fire({
      title: 'Mute all attendees?',
      text: 'Remote microphone control is not available yet. Each participant must mute themselves.',
      icon: 'info',
      confirmButtonText: 'Got it',
      customClass: {
        popup: 'lp-swal-popup',
        confirmButton: 'lp-swal-confirm',
      },
    });
  }

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
      this.isFullscreen.set(true);
    } else {
      void document.exitFullscreen();
      this.isFullscreen.set(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Leave
  // ---------------------------------------------------------------------------

  leaveCall(): void {
    void Swal.fire({
      title: 'Leave Meeting?',
      text: 'Are you sure you want to exit the conference room?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Leave Call',
      cancelButtonText: 'Stay in Meeting',
      customClass: {
        popup: 'lp-swal-popup',
        confirmButton: 'lp-swal-confirm danger-confirm',
        cancelButton: 'lp-swal-cancel',
      },
    }).then((res) => {
      if (res.isConfirmed) {
        this.leaveMeeting();
      }
    });
  }

  private leaveMeeting(): void {
    this.mediasoup.leave();
    this.stopAllMediaTracks();
    this.screenStream()?.getTracks().forEach((track) => track.stop());
    this.screenStream.set(null);

    this.isJoined.set(false);
    this.isHost.set(false);
    this.selfParticipantId.set('');
    this.participants.set([]);
    this.remoteStreams.set(new Map());
    this.remoteScreenShare.set(null);
    this.chatMessages.set([]);
    this.isScreenSharing.set(false);
    this.isHandRaised.set(false);
    this.isMuted.set(false);
    this.isVideoOn.set(true);
    this.isSelfSpeaking.set(false);
    this.pinnedParticipantId.set(null);
    this.activeDrawer.set('none');
    this.elapsedSeconds.set(0);
    this.unreadChatCount.set(0);
    this.currentCaption.set(null);
    this.errorMessage.set(null);
  }

  /** Host-only action: close the room for everyone. */
  endMeetingForAll(): void {
    if (!this.isHost()) {
      return;
    }

    void Swal.fire({
      title: 'End meeting for everyone?',
      text: 'Every participant will be removed and the room will be closed.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'End Meeting',
      cancelButtonText: 'Cancel',
      customClass: {
        popup: 'lp-swal-popup',
        confirmButton: 'lp-swal-confirm danger-confirm',
        cancelButton: 'lp-swal-cancel',
      },
    }).then(async (res) => {
      if (!res.isConfirmed) {
        return;
      }
      try {
        await this.mediasoup.endMeeting();
      } catch (error) {
        this.errorMessage.set(
          error instanceof Error ? error.message : 'Could not end the meeting.',
        );
      } finally {
        this.leaveMeeting();
      }
    });
  }

  private handleMeetingEnded(): void {
    this.leaveMeeting();
    void Swal.fire({
      icon: 'info',
      title: 'Meeting ended',
      text: 'The host ended this meeting. You have been returned to the lobby.',
      confirmButtonColor: '#0ea5e9',
      customClass: {
        popup: 'lp-swal-popup',
        confirmButton: 'lp-swal-confirm',
      },
    });
  }

  private stopAllMediaTracks(): void {
    const local = this.localStream();
    local?.getTracks().forEach((track) => track.stop());
    this.localStream.set(null);

    const screen = this.screenStream();
    screen?.getTracks().forEach((track) => track.stop());
    this.screenStream.set(null);
  }
}
