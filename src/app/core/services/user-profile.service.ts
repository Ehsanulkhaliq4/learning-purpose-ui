import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UpdateUserProfileRequest, UserProfile } from '../models/user-profile.models';

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/v1/users/me';

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.apiUrl);
  }

  updateProfile(request: UpdateUserProfileRequest): Observable<UserProfile> {
    return this.http.put<UserProfile>(this.apiUrl, request);
  }

  deactivateAccount(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/deactivate`, {});
  }
}
