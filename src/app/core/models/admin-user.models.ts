export interface AdminManagedUser {
  id: number;
  username: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  enabled: boolean;
  createdAt: string | null;
  deactivatedUntil: string | null;
}

export type DeactivationPeriod = 'FIFTEEN_DAYS' | 'THIRTY_DAYS' | 'PERMANENT' | 'CUSTOM';

export interface AccountStatusUpdate {
  active: boolean;
  period?: DeactivationPeriod;
  reactivatesAt?: string;
}
