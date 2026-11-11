import { isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, HostListener, inject, OnInit, output, PLATFORM_ID, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MessagingService } from '../../core/services/messaging.service';

@Component({
  imports: [RouterLink],
  selector: 'app-topbar',
  styleUrl: './topbar.css',
  templateUrl: './topbar.html',
})
export class Topbar implements OnInit {
  readonly auth = inject(AuthService);
  readonly messaging = inject(MessagingService);
  readonly toggleAiDrawer = output<void>();
  readonly isDropdownOpen = signal(false);

  private readonly elementRef = inject(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.auth.ensureCurrentUserId().subscribe({
      next: (userId) => this.messaging.connectRealtime(userId),
      error: () => {
        this.messaging.isRealtimeConnected.set(false);
        this.messaging.notificationError.set('Could not identify your account for live notifications.');
      },
    });
  }

  toggleDropdown(): void {
    this.isDropdownOpen.update((open) => !open);
  }

  closeDropdown(): void {
    this.isDropdownOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeDropdown();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeDropdown();
  }
}
