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
  phone: string;
  password: string;
}

export type RegisterApplicantResponse = AuthResponse;

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: number;
  newPassword: string;
}