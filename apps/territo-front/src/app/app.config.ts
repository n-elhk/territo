import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { appRoutes } from './app.routes';
import { apiErrorInterceptor } from './core/api-error.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { refreshInterceptor } from './core/interceptors/refresh.interceptor';
import { UserStore } from './core/user.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideHttpClient(
      withFetch(),
      withInterceptors([
        authInterceptor,
        refreshInterceptor,
        apiErrorInterceptor,
      ]),
    ),
    // Hydrate l'utilisateur courant depuis le cookie httpOnly avant le
    // premier rendu : les guards de routes lisent un état déjà cohérent
    // avec le serveur. Un 401 (session absente / expirée) est silencieux.
    provideAppInitializer(() => inject(UserStore).fetchMe()),
  ],
};
