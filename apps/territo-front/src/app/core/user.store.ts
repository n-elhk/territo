import { computed, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { lastValueFrom } from 'rxjs';
import type { LoginDto, RegisterDto } from '@territo/schemas';
import { AuthService, AuthUser } from './auth.service';
import { ApiError, parseApiError } from './api-error';

type RequestStatus = 'idle' | 'pending' | 'success' | 'error';

interface UserState {
  currentUser: AuthUser | null;
  status: RequestStatus;
  error: ApiError | null;
}

const initialState: UserState = {
  currentUser: null,
  status: 'idle',
  error: null,
};

export type UserStoreInstance = InstanceType<typeof UserStore>;

export const UserStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ currentUser, status }) => ({
    isAuthenticated: computed(() => currentUser() !== null),
    isPending: computed(() => status() === 'pending'),
  })),
  withMethods((store) => {
    const auth = inject(AuthService);

    return {
      clear() {
        patchState(store, { currentUser: null, status: 'idle', error: null });
      },

      async login({ email, password }: LoginDto) {
        patchState(store, { status: 'pending', error: null });
        try {
          const user = await lastValueFrom(auth.login({ email, password }));
          patchState(store, { currentUser: user, status: 'success' });
        } catch (err) {
          patchState(store, { error: parseApiError(err as HttpErrorResponse), status: 'error' });
          throw err;
        }
      },

      async register({ email, password, name }: RegisterDto) {
        patchState(store, { status: 'pending', error: null });
        try {
          const user = await lastValueFrom(auth.register({ email, password, name }));
          patchState(store, { currentUser: user, status: 'success' });
        } catch (err) {
          patchState(store, { error: parseApiError(err as HttpErrorResponse), status: 'error' });
          throw err;
        }
      },

      async logout() {
        patchState(store, { status: 'pending', error: null });
        try {
          await lastValueFrom(auth.logout());
          patchState(store, { currentUser: null, status: 'success' });
        } catch (err) {
          patchState(store, { error: parseApiError(err as HttpErrorResponse), status: 'error' });
          throw err;
        }
      },

      async me() {
        patchState(store, { status: 'pending', error: null });
        try {
          const user = await lastValueFrom(auth.me());
          patchState(store, { currentUser: user, status: 'success' });
        } catch (err) {
          patchState(store, { error: parseApiError(err as HttpErrorResponse), status: 'error' });
          throw err;
        }
      },

      async fetchMe() {
        patchState(store, { status: 'pending', error: null });
        try {
          const user = await lastValueFrom(auth.me());
          patchState(store, { currentUser: user, status: 'success' });
        } catch {
          patchState(store, { currentUser: null, status: 'idle', error: null });
        }
      },
    };
  }),
);
