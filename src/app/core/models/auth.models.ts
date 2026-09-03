export interface UserIdentity {
  id?: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
}

export interface AuthResponse {
  token: string;
  username: string;
  email: string;
  roles: string[];
}

export interface RegisterApplicantRequest {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
}

export interface RegisterApplicantResponse {
  message?: string;
  userId?: number;
  username?: string;
  email?: string;
}