import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { UserStore } from './user.store';
import { filter, map } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const store = inject(UserStore);
  const router = inject(Router);

  const isPending$ = toObservable(store.isPending);

  return isPending$.pipe(
    filter((isPending) => !isPending),
    map(() =>
      store.isAuthenticated() ? true : router.createUrlTree(['/login']),
    ),
  );

};

export const guestGuard: CanActivateFn = () => {
  const store = inject(UserStore);
  const router = inject(Router);
  return store.isAuthenticated() ? router.createUrlTree(['/']) : true;
};
