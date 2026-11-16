import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AdminManagedUser, AccountStatusUpdate } from '../models/admin-user.models';

@Injectable({ providedIn: 'root' })
export class AdminUserManagementService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/v1/users/admin/managed';

  listUsers() {
    return this.http.get<AdminManagedUser[]>(this.apiUrl);
  }

  updateAccountStatus(userId: number, update: AccountStatusUpdate) {
    return this.http.put<AdminManagedUser>(`${this.apiUrl}/${userId}/status`, update);
  }
}
