import { Component, computed, inject, signal, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { AuthService } from '../../../core/services/auth.service';
import { MediaService } from '../../../core/services/media.service';

export interface ConferenceParticipant {
  id: number;
  name: string;
  role: string;
  muted: boolean;
  videoOn: boolean;
  speaking: boolean;
  avatar: string;
  color?: string;
  handRaised?: boolean;
  isHost?: boolean;
  avatarBg?: string;
}

export interface FloatingReaction {
  id: number;
  emoji: string;
  x: number;
  sender: string;
}

export interface ChatMessage {
  id: number;
  sender: string;
  time: string;
  text: string;
  isSelf: boolean;
  avatar: string;
}

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

  readonly roomId = signal('meet-' + Math.random().toString(36).substring(2, 8));
  readonly defaultUserId = computed(() => this.authService.currentUser()?.username ?? 'Guest User');
  readonly customUserName = signal('');
  readonly effectiveUserName = computed(() => this.customUserName().trim() || this.defaultUserId());
  readonly roomTitle = signal('Quarterly Strategy & Product Sync');

  // Meeting state
  readonly isJoined = signal(false);
  readonly isStartingMedia = signal(false);
  readonly isMuted = signal(false);
  readonly isVideoOn = signal(true);
  readonly isScreenSharing = signal(false);
  readonly isHandRaised = signal(false);
  readonly isRecording = signal(true);
  readonly isCaptionsOn = signal(false);
  readonly isFullscreen = signal(false);
  readonly errorMessage = signal<string | null>(null);

  // Layout & Drawers
  readonly layoutMode = signal<'grid' | 'spotlight' | 'sidebar'>('grid');
  readonly activeDrawer = signal<'none' | 'chat' | 'participants' | 'info' | 'settings'>('none');
  readonly activeTab = signal<'create' | 'join'>('create');
  readonly searchParticipantQuery = signal('');
  readonly pinnedParticipantId = signal<number | null>(null);

  // Streams & Audio
  readonly localStream = signal<MediaStream | null>(null);
  readonly screenStream = signal<MediaStream | null>(null);
  readonly audioLevel = signal(65);

  // Timer
  readonly elapsedSeconds = signal(342); // starts at ~5:42
  private timerInterval: any = null;
  private captionInterval: any = null;
  private speakingInterval: any = null;

  // Closed Captions & Live transcript
  readonly currentCaption = signal<{ speaker: string; text: string } | null>(null);

  // Floating Reactions
  readonly floatingReactions = signal<FloatingReaction[]>([]);
  readonly quickEmojis = ['❤️', '👏', '👍', '🎉', '🔥', '😂', '🚀', '💯'];

  // Chat
  readonly newChatMessage = signal('');
  readonly unreadChatCount = signal(2);
  readonly chatMessages = signal<ChatMessage[]>([
    {
      id: 1,
      sender: 'Aisha Chen',
      time: '10:32 AM',
      text: 'Good morning everyone! Slide deck is updated on the drive.',
      isSelf: false,
      avatar: 'AC',
    },
    {
      id: 2,
      sender: 'Daniel Miller',
      time: '10:33 AM',
      text: 'Audio is coming through super crisp. Ready whenever you are.',
      isSelf: false,
      avatar: 'DM',
    },
  ]);

  // Settings
  readonly virtualBackground = signal<'none' | 'blur' | 'modern' | 'minimal'>('blur');
  readonly noiseSuppression = signal(true);
  readonly hdVideoQuality = signal(true);
  readonly selectedMic = signal('Default - Internal Microphone');
  readonly selectedCamera = signal('FaceTime HD Camera (Built-in)');

  // Participants with clean professional neutral avatars
  readonly participants = signal<ConferenceParticipant[]>([
    {
      id: 1,
      name: 'You',
      role: 'Host',
      muted: false,
      videoOn: true,
      speaking: false,
      avatar: 'Y',
      isHost: true,
      color: '#ffffff',
      avatarBg: '#2d3748',
    },
    {
      id: 2,
      name: 'Aisha Chen',
      role: 'Product Lead',
      muted: false,
      videoOn: true,
      speaking: true,
      avatar: 'AC',
      color: '#ffffff',
      avatarBg: '#334155',
    },
    {
      id: 3,
      name: 'Daniel Miller',
      role: 'Staff Architect',
      muted: true,
      videoOn: true,
      speaking: false,
      avatar: 'DM',
      color: '#ffffff',
      avatarBg: '#374151',
    },
    {
      id: 4,
      name: 'Maya Patel',
      role: 'Principal Designer',
      muted: false,
      videoOn: false,
      speaking: false,
      avatar: 'MP',
      color: '#ffffff',
      avatarBg: '#475569',
    },
    {
      id: 5,
      name: 'Samir Rivera',
      role: 'Engineering Director',
      muted: false,
      videoOn: true,
      speaking: false,
      avatar: 'SR',
      color: '#ffffff',
      avatarBg: '#3b4252',
    },
    {
      id: 6,
      name: 'Elena Rostova',
      role: 'Security & QA',
      muted: true,
      videoOn: false,
      speaking: false,
      avatar: 'ER',
      color: '#ffffff',
      avatarBg: '#27272a',
    },
  ]);

  // Filtered participants
  readonly filteredParticipants = computed(() => {
    const q = this.searchParticipantQuery().toLowerCase().trim();
    if (!q) return this.participants();
    return this.participants().filter(
      (p) => p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q)
    );
  });

  // Current active speaker or spotlight participant
  readonly activeSpotlight = computed(() => {
    const pinnedId = this.pinnedParticipantId();
    if (pinnedId) {
      const pinned = this.participants().find((p) => p.id === pinnedId);
      if (pinned) return pinned;
    }
    const speaking = this.participants().find((p) => p.speaking);
    return speaking ?? this.participants()[0];
  });

  // Formatted timer
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

  ngOnInit(): void {
    this.startTimer();
    this.startSpeakingSimulation();
  }

  ngOnDestroy(): void {
    this.stopTimer();
    this.stopCaptions();
    if (this.speakingInterval) clearInterval(this.speakingInterval);
    this.stopAllMediaTracks();
  }

  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds.update((s) => s + 1);
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private startSpeakingSimulation(): void {
    // Cycles active speaking status realistically
    this.speakingInterval = setInterval(() => {
      if (!this.isJoined()) return;
      const currentList = this.participants();
      const eligible = currentList.filter((p) => !p.muted && p.id !== 1);
      if (eligible.length === 0) return;

      const randomIdx = Math.floor(Math.random() * eligible.length);
      const chosenId = eligible[randomIdx].id;

      this.participants.update((list) =>
        list.map((p) => ({
          ...p,
          speaking: p.id === chosenId ? Math.random() > 0.3 : false,
        }))
      );

      if (this.isCaptionsOn()) {
        const speakingPerson = this.participants().find((p) => p.speaking);
        if (speakingPerson) {
          const sampleLines = [
            'Looking at our sprint metrics, the response time has dropped by 45%.',
            'We have aligned the API schema with the latest frontend contracts.',
            'Let us review the security audit findings before deployment.',
            'Great progress everyone! Let us lock in these architectural updates.',
            'I will push the staging verification build right after this sync.',
          ];
          this.currentCaption.set({
            speaker: speakingPerson.name,
            text: sampleLines[Math.floor(Math.random() * sampleLines.length)],
          });
        }
      }
    }, 4500);
  }

  async startLocalMedia(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.errorMessage.set('This browser does not support microphone/camera access.');
      return;
    }

    this.isStartingMedia.set(true);
    this.errorMessage.set(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });

      this.localStream.set(stream);
      this.isVideoOn.set(true);
      this.isMuted.set(false);
    } catch {
      this.errorMessage.set('Camera or microphone permission was denied. You can still participate in audio/chat mode.');
    } finally {
      this.isStartingMedia.set(false);
    }
  }

  createRoom(): void {
    this.errorMessage.set(null);
    if (!this.roomId().trim()) {
      this.roomId.set('meet-' + Math.random().toString(36).substring(2, 8));
    }

    // Enter room immediately
    this.isJoined.set(true);
    if (!this.localStream()) {
      void this.startLocalMedia();
    }

    // Call service asynchronously in background
    this.mediaService.createConferenceRoom(this.roomId()).subscribe({
      next: () => {
        void Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: `Room created: ${this.roomId()}`,
          showConfirmButton: false,
          timer: 2500,
          background: '#202124',
          color: '#e8eaed',
        });
      },
      error: () => {
        // Continue seamlessly in local/demo mode
      },
    });
  }

  joinRoom(): void {
    if (!this.roomId().trim()) {
      this.errorMessage.set('Please enter a valid Room Code or ID.');
      return;
    }
    this.errorMessage.set(null);

    // Enter room immediately
    this.isJoined.set(true);
    if (!this.localStream()) {
      void this.startLocalMedia();
    }

    this.mediaService.joinConferenceParticipant(this.roomId(), this.effectiveUserName()).subscribe({
      next: () => {
        void Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: `Joined room ${this.roomId()}`,
          showConfirmButton: false,
          timer: 2500,
          background: '#202124',
          color: '#e8eaed',
        });
      },
      error: () => {
        // Continue seamlessly in local/demo mode
      },
    });
  }

  showRoomInvitePopup(): void {
    void Swal.fire({
      title: 'Meeting is Ready',
      html: `
        <div style="text-align: left; padding: 0.5rem 0;">
          <p style="color: #94a3b8; font-size: 0.88rem; margin-bottom: 0.75rem;">
            Share this Room Code with teammates to invite them:
          </p>
          <div style="background: rgba(15, 23, 42, 0.85); border: 1px dashed #38bdf8; border-radius: 10px; padding: 0.85rem; font-family: monospace; font-size: 1.15rem; font-weight: 700; color: #38bdf8; display: flex; justify-content: space-between; align-items: center;">
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
        background: '#0f172a',
        color: '#f8fafc',
      });
    } catch {
      // Fallback
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
        background: '#0f172a',
        color: '#f8fafc',
      });
    } catch {
      // Fallback
    }
  }

  toggleMute(): void {
    this.isMuted.update((val) => !val);
    const stream = this.localStream();
    stream?.getAudioTracks().forEach((track) => {
      track.enabled = !this.isMuted();
    });

    this.participants.update((list) =>
      list.map((p) => (p.id === 1 ? { ...p, muted: this.isMuted() } : p))
    );
  }

  toggleVideo(): void {
    this.isVideoOn.update((val) => !val);
    const stream = this.localStream();
    stream?.getVideoTracks().forEach((track) => {
      track.enabled = this.isVideoOn();
    });

    this.participants.update((list) =>
      list.map((p) => (p.id === 1 ? { ...p, videoOn: this.isVideoOn() } : p))
    );
  }

  async toggleScreenShare(): Promise<void> {
    if (this.isScreenSharing()) {
      const screen = this.screenStream();
      screen?.getTracks().forEach((t) => t.stop());
      this.screenStream.set(null);
      this.isScreenSharing.set(false);
      return;
    }

    try {
      if (navigator.mediaDevices?.getDisplayMedia) {
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        this.screenStream.set(display);
        display.getVideoTracks()[0].onended = () => {
          this.isScreenSharing.set(false);
          this.screenStream.set(null);
        };
        this.isScreenSharing.set(true);
      } else {
        this.isScreenSharing.set(true);
      }
    } catch {
      // User cancelled screen picker
      this.isScreenSharing.set(false);
    }
  }

  toggleHandRaise(): void {
    this.isHandRaised.update((val) => !val);
    this.participants.update((list) =>
      list.map((p) => (p.id === 1 ? { ...p, handRaised: this.isHandRaised() } : p))
    );
    if (this.isHandRaised()) {
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
      background: '#0f172a',
      color: '#f8fafc',
    });
  }

  toggleCaptions(): void {
    this.isCaptionsOn.update((val) => !val);
    if (this.isCaptionsOn()) {
      this.currentCaption.set({
        speaker: 'Aisha Chen',
        text: 'Live automated captions are now active.',
      });
    } else {
      this.currentCaption.set(null);
    }
  }

  private stopCaptions(): void {
    if (this.captionInterval) {
      clearInterval(this.captionInterval);
      this.captionInterval = null;
    }
  }

  triggerReaction(emoji: string): void {
    const id = Date.now() + Math.random();
    const x = Math.floor(Math.random() * 60) + 20; // 20% to 80% horizontal offset
    const reaction: FloatingReaction = {
      id,
      emoji,
      x,
      sender: this.effectiveUserName(),
    };

    this.floatingReactions.update((current) => [...current, reaction]);

    // Auto clear after animation completes (2.5s)
    setTimeout(() => {
      this.floatingReactions.update((current) => current.filter((r) => r.id !== id));
    }, 2400);
  }

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

  pinParticipant(id: number): void {
    if (this.pinnedParticipantId() === id) {
      this.pinnedParticipantId.set(null);
    } else {
      this.pinnedParticipantId.set(id);
      this.layoutMode.set('spotlight');
    }
  }

  toggleParticipantMute(id: number): void {
    this.participants.update((list) =>
      list.map((p) => (p.id === id ? { ...p, muted: !p.muted } : p))
    );
  }

  muteAllParticipants(): void {
    void Swal.fire({
      title: 'Mute all attendees?',
      text: 'Everyone in this room except you will be muted. They can unmute themselves when ready.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Mute All',
      cancelButtonText: 'Cancel',
      customClass: {
        popup: 'lp-swal-popup',
        confirmButton: 'lp-swal-confirm',
        cancelButton: 'lp-swal-cancel',
      },
    }).then((res) => {
      if (res.isConfirmed) {
        this.participants.update((list) =>
          list.map((p) => (p.id !== 1 ? { ...p, muted: true, speaking: false } : p))
        );
        void Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'All participants muted',
          timer: 1800,
          showConfirmButton: false,
          background: '#0f172a',
          color: '#f8fafc',
        });
      }
    });
  }

  sendChatMessage(): void {
    const text = this.newChatMessage().trim();
    if (!text) return;

    const newMsg: ChatMessage = {
      id: Date.now(),
      sender: 'You',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text,
      isSelf: true,
      avatar: 'Y',
    };

    this.chatMessages.update((msgs) => [...msgs, newMsg]);
    this.newChatMessage.set('');

    // Simulated reply after 3s if chat is lonely
    if (this.chatMessages().length === 3) {
      setTimeout(() => {
        this.chatMessages.update((msgs) => [
          ...msgs,
          {
            id: Date.now() + 1,
            sender: 'Maya Patel',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text: 'I have attached the UI wireframes in Figma. Great point!',
            isSelf: false,
            avatar: 'MP',
          },
        ]);
        if (this.activeDrawer() !== 'chat') {
          this.unreadChatCount.update((c) => c + 1);
        }
      }, 2500);
    }
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
        this.stopAllMediaTracks();
        this.isJoined.set(false);
        this.isScreenSharing.set(false);
        this.isHandRaised.set(false);
        this.pinnedParticipantId.set(null);
        this.activeDrawer.set('none');
      }
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

