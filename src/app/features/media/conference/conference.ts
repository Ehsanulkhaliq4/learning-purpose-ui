import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { AuthService } from '../../../core/services/auth.service';
import { MediaService } from '../../../core/services/media.service';

interface ConferenceParticipant {
  id: number;
  name: string;
  role: string;
  muted: boolean;
  videoOn: boolean;
  speaking: boolean;
  avatar: string;
}

@Component({
  selector: 'app-conference-room',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './conference.html',
  styleUrl: './conference.css',
})
export class ConferenceRoomPage {
  private readonly mediaService = inject(MediaService);
  private readonly authService = inject(AuthService);

  readonly roomId = signal('hdfsfmkdm');
  readonly userId = computed(() => this.authService.currentUser()?.username ?? 'Guest');
  readonly roomTitle = signal('Design Sprint Review');
  readonly isMuted = signal(false);
  readonly isVideoOn = signal(true);
  readonly isScreenSharing = signal(false);
  readonly isJoined = signal(false);
  readonly isStartingMedia = signal(false);
  readonly localStream = signal<MediaStream | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly participants = signal<ConferenceParticipant[]>([
    { id: 1, name: 'You', role: 'Host', muted: false, videoOn: true, speaking: true, avatar: 'Y' },
    { id: 2, name: 'Aisha', role: 'Product', muted: false, videoOn: true, speaking: false, avatar: 'A' },
    { id: 3, name: 'Daniel', role: 'Engineering', muted: true, videoOn: true, speaking: false, avatar: 'D' },
    { id: 4, name: 'Maya', role: 'Design', muted: false, videoOn: false, speaking: false, avatar: 'M' },
    { id: 5, name: 'Sam', role: 'Marketing', muted: false, videoOn: true, speaking: false, avatar: 'S' },
    { id: 6, name: 'Leo', role: 'Ops', muted: true, videoOn: false, speaking: false, avatar: 'L' },
  ]);

  async startLocalMedia(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.errorMessage.set('This browser does not support microphone/camera access.');
      return;
    }

    this.isStartingMedia.set(true);
    this.errorMessage.set(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      this.localStream.set(stream);
      this.isVideoOn.set(true);
      this.isMuted.set(false);
      this.isJoiningRoom();
    } catch {
      this.errorMessage.set('Camera and microphone permission was denied. Please allow access to join the call.');
    } finally {
      this.isStartingMedia.set(false);
    }
  }

  private showRoomInvitePopup(): void {
    void Swal.fire({
      title: 'Room ready',
      text: `Share this room ID with your friend: ${this.roomId()}`,
      icon: 'info',
      showCancelButton: false,
      confirmButtonText: 'Copy room ID',
      customClass: {
        popup: 'lp-swal-popup',
        title: 'lp-swal-title',
        htmlContainer: 'lp-swal-text',
        confirmButton: 'lp-swal-confirm',
      },
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      await navigator.clipboard.writeText(this.roomId());
      await Swal.fire({
        title: 'Copied',
        text: 'Room ID copied to clipboard.',
        icon: 'success',
        timer: 1400,
        showConfirmButton: false,
      });
    });
  }

  createRoom(): void {
    this.errorMessage.set(null);
    this.mediaService.createConferenceRoom(this.roomId()).subscribe({
      next: () => {
        this.isJoined.set(true);
        this.showRoomInvitePopup();
        void this.startLocalMedia();
      },
      error: (error) => {
        this.errorMessage.set(error?.error?.message || 'Could not create the room.');
      },
    });
  }

  joinRoom(): void {
    this.errorMessage.set(null);
    this.mediaService.joinConferenceParticipant(this.roomId(), this.userId()).subscribe({
      next: () => {
        this.isJoined.set(true);
        void this.startLocalMedia();
      },
      error: (error) => {
        this.errorMessage.set(error?.error?.message || 'Could not join this room.');
      },
    });
  }

  isJoiningRoom(): void {
    this.isJoined.set(true);
  }

  createTransport(): void {
    this.mediaService.createConferenceTransport(this.roomId(), this.userId(), 'sendrecv').subscribe({
      next: () => {
        this.isJoined.set(true);
      },
      error: (error) => {
        this.errorMessage.set(error?.error?.message || 'Could not create the media transport.');
      },
    });
  }

  toggleMute(): void {
    this.isMuted.update((value) => !value);
    const stream = this.localStream();
    stream?.getAudioTracks().forEach((track) => {
      track.enabled = !this.isMuted();
    });
  }

  toggleVideo(): void {
    this.isVideoOn.update((value) => !value);
    const stream = this.localStream();
    stream?.getVideoTracks().forEach((track) => {
      track.enabled = this.isVideoOn();
    });
  }

  toggleScreenShare(): void {
    this.isScreenSharing.update((value) => !value);
  }

  leaveCall(): void {
    const stream = this.localStream();
    stream?.getTracks().forEach((track) => track.stop());
    this.localStream.set(null);
    this.isJoined.set(false);
    this.isMuted.set(false);
    this.isVideoOn.set(false);
    this.isScreenSharing.set(false);
  }
}
