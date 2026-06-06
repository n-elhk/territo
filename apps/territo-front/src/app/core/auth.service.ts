import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { IS_AUTH_ENDPOINT } from './interceptors/http-context.tokens';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

const authContext = new HttpContext().set(IS_AUTH_ENDPOINT, true);

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/auth';

  login(email: string, password: string) {
    return this.http.post<AuthUser>(`${this.baseUrl}/login`, { email, password }, { context: authContext });
  }

  register(email: string, password: string, name?: string) {
    return this.http.post<AuthUser>(`${this.baseUrl}/register`, { email, password, name }, { context: authContext });
  }

  logout() {
    return this.http.post<void>(`${this.baseUrl}/logout`, {}, { context: authContext });
  }

  refresh() {
    return this.http.post<void>(`${this.baseUrl}/refresh`, {}, { context: authContext });
  }

  me() {
    return this.http.post<AuthUser>(`${this.baseUrl}/me`, {}, { context: authContext });
  }
}
