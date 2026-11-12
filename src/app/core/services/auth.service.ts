import { Injectable, signal, computed, inject } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, map, of, tap, throwError } from 'rxjs';
import { AuthResponse, UserIdentity, RegisterApplicantRequest, RegisterApplicantResponse, ForgotPasswordResponse, ResetPasswordRequest } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly API_URL = 'http://localhost:8080/api/v1/auth';
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly tokenSignal = signal<string | null>(
    this.isBrowser ? localStorage.getItem('access_token') : null,
  );
  private readonly userSignal = signal<UserIdentity | null>(
    this.isBrowser ? JSON.parse(localStorage.getItem('auth_user') || 'null') : null,
  );

  readonly isAuthenticated = computed(() => !!this.tokenSignal());
  readonly currentUser = computed(() => this.userSignal());
  readonly isAdmin = computed(() => this.userSignal()?.roles.includes('ROLE_ADMIN') ?? false);

  ensureCurrentUserId(): Observable<number> {
    const user = this.userSignal();
    if (!user?.username) {
      return throwError(() => new Error('Your signed-in account does not include a username.'));
    }

    const userId = user.id;
    if (userId !== undefined && Number.isSafeInteger(userId) && userId > 0) {
      return of(userId);
    }

    return this.http
      .get<{
        id: number;
        username: string;
        email: string;
        firstName?: string;
        lastName?: string;
        phone?: string;
        profile?: string;
        enabled?: boolean;
      }>('http://localhost:8080/api/v1/users/me')
      .pipe(
        map((profile) => {
          if (!Number.isSafeInteger(profile.id) || profile.id <= 0) {
            throw new Error('The user profile did not include a valid numeric ID.');
          }

          const identity: UserIdentity = {
            ...user,
            id: profile.id,
            email: profile.email ?? user.email,
            firstName: profile.firstName ?? user.firstName,
            lastName: profile.lastName ?? user.lastName,
            phone: profile.phone,
            profile: profile.profile,
            enabled: profile.enabled,
          };
          this.userSignal.set(identity);
          if (this.isBrowser) {
            localStorage.setItem('auth_user', JSON.stringify(identity));
          }
          return profile.id;
        }),
      );
  }

  updateCurrentUser(identity: Partial<UserIdentity>): void {
    const user = this.userSignal();
    if (!user) return;
    const updated = { ...user, ...identity };
    this.userSignal.set(updated);
    if (this.isBrowser) {
      localStorage.setItem('auth_user', JSON.stringify(updated));
    }
  }

  registerApplicant(payload: RegisterApplicantRequest): Observable<RegisterApplicantResponse> {
    return this.http.post<RegisterApplicantResponse>(`${this.API_URL}/register`, payload).pipe(
      tap((res) => this.setAuthenticatedSession(res)),
    );
  }

  requestPasswordResetOtp(email: string): Observable<ForgotPasswordResponse> {
    const params = new HttpParams().set('email', email);
    return this.http.post<ForgotPasswordResponse>(`${this.API_URL}/forgot-password`, null, { params });
  }

  resetPassword(payload: ResetPasswordRequest): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(`${this.API_URL}/reset-password`, payload);
  }

  startDemoSession(username: string): void {
    const identity: UserIdentity = {
      username,
      email: `${username}@demo.learningpurpose.local`,
      roles: ['ROLE_USER'],
    };

    if (this.isBrowser) {
      localStorage.setItem('access_token', 'demo-user-token');
      localStorage.setItem('auth_user', JSON.stringify(identity));
    }

    this.tokenSignal.set('demo-user-token');
    this.userSignal.set(identity);
  }

  login(credentials: { username: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, credentials).pipe(
      tap((res) => { 
        console.log('Login successful:', res);
        this.setAuthenticatedSession(res); }),
    );
  }

  private setAuthenticatedSession(res: AuthResponse): void {
    const identity: UserIdentity = {
      id: res.id,
      username: res.username,
      email: res.email,
      roles: res.roles,
    };
    if (this.isBrowser) {
      localStorage.setItem('access_token', res.token);
      localStorage.setItem('auth_user', JSON.stringify(identity));
    }
    this.tokenSignal.set(res.token);
    this.userSignal.set(identity);
  }

  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('auth_user');
    }
    this.tokenSignal.set(null);
    this.userSignal.set(null);
    this.router.navigate(['/'], { replaceUrl: true });
  }

  getToken(): string | null {
    return this.tokenSignal();
  }
}