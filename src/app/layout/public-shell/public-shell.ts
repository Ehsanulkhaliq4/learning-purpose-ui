import { Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthDialogService } from '../../core/services/auth-dialog.service';
import { Login } from '../../features/auth/login/login';
import { RegisterApplicant } from '../../features/auth/register-applicant/register-applicant';

@Component({
  selector: 'app-public-shell',
  imports: [Login, RegisterApplicant, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './public-shell.html',
  styleUrl: './public-shell.css',
})
export class PublicShell {
  readonly authDialogService = inject(AuthDialogService);
  private readonly authDialog = viewChild<ElementRef<HTMLDialogElement>>('authDialog');

  constructor() {
    effect(() => {
      const mode = this.authDialogService.mode();
      const dialog = this.authDialog()?.nativeElement;
      if (!dialog) return;

      if (mode && !dialog.open) dialog.showModal();
      if (!mode && dialog.open) dialog.close();
    });
  }

  closeAuthDialog(): void {
    this.authDialogService.close();
  }

  closeOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeAuthDialog();
  }
}
