import { Route } from '@angular/router';
import { guestGuard } from './core/auth.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    // canActivate: [authGuard],
    loadComponent: () => import('./features/home').then((m) => m.HomeComponent),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register').then((m) => m.RegisterComponent),
  },
  { path: '**', redirectTo: '' },
];
