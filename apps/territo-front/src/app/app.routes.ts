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
  {
    path: 'map',
    loadComponent: () => import('./features/map/map').then((m) => m.MapPageComponent),
  },
  {
    path: 'local-opportunities',
    loadComponent: () =>
      import('./features/local-opportunities/local-opportunities').then(
        (m) => m.LocalOpportunitiesComponent,
      ),
  },
  { path: '**', redirectTo: '' },
];
