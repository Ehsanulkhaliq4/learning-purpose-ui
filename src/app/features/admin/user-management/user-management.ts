import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AccountStatusUpdate, AdminManagedUser, DeactivationPeriod } from '../../../core/models/admin-user.models';
import { AdminUserManagementService } from '../../../core/services/admin-user-management.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  imports: [DatePipe],
  selector: 'app-user-management',
  styleUrl: './user-management.css',
  templateUrl: './user-management.html',
})
export class UserManagement implements OnInit {
  readonly auth = inject(AuthService);
  private readonly userManagement = inject(AdminUserManagementService);

  readonly users = signal<AdminManagedUser[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly selectedUser = signal<AdminManagedUser | null>(null);
  readonly selectedPeriod = signal<DeactivationPeriod>('FIFTEEN_DAYS');
  readonly customReactivationTime = signal('');

  ngOnInit(): void {
    if (this.auth.isAdmin()) this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.error.set('');
    this.userManagement.listUsers().subscribe({
      next: (users) => this.users.set(users),
      error: (err) => this.error.set(this.errorMessage(err, 'Could not load user accounts.')),
    }).add(() => this.loading.set(false));
  }

  openDeactivation(user: AdminManagedUser): void {
    this.selectedUser.set(user);
    this.selectedPeriod.set('FIFTEEN_DAYS');
    this.customReactivationTime.set('');
  }

  cancelDeactivation(): void {
    this.selectedUser.set(null);
  }

  deactivateSelected(): void {
    const user = this.selectedUser();
    if (!user || this.saving()) return;

    const period = this.selectedPeriod();
    let reactivatesAt: string | undefined;
    if (period === 'CUSTOM') {
      const localTime = this.customReactivationTime();
      const timestamp = new Date(localTime);
      if (!localTime || Number.isNaN(timestamp.getTime()) || timestamp.getTime() <= Date.now()) {
        this.error.set('Choose a reactivation date and time in the future.');
        return;
      }
      reactivatesAt = timestamp.toISOString();
    }

    this.updateUser(user.id, {
      active: false,
      period,
      ...(reactivatesAt ? { reactivatesAt } : {}),
    });
  }

  activate(user: AdminManagedUser): void {
    this.updateUser(user.id, { active: true });
  }

  private updateUser(userId: number, request: AccountStatusUpdate): void {
    this.saving.set(true);
    this.error.set('');
    this.userManagement.updateAccountStatus(userId, request).pipe(
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: (updatedUser) => {
        this.users.update((users) => users.map((user) => user.id === updatedUser.id ? updatedUser : user));
        this.selectedUser.set(null);
      },
      error: (err) => this.error.set(this.errorMessage(err, 'Could not update the account status.')),
    });
  }

  displayName(user: AdminManagedUser): string {
    return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username;
  }

  private errorMessage(err: { error?: { message?: string; error?: string } }, fallback: string): string {
    return err?.error?.message || err?.error?.error || fallback;
  }
}
