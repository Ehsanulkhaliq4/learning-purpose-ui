import { Component, ElementRef, HostListener, inject, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  imports: [RouterLink],
  selector: 'app-topbar',
  styleUrl: './topbar.css',
  templateUrl: './topbar.html',
})
export class Topbar {
  readonly auth = inject(AuthService);
  readonly toggleAiDrawer = output<void>();
  readonly isDropdownOpen = signal(false);

  private readonly elementRef = inject(ElementRef);

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
