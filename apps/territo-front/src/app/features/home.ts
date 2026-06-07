import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UserStore } from '../core/user.store';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <div class="min-h-screen bg-gray-50">
      <header class="bg-white border-b border-gray-200">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <span class="text-xl font-bold text-gray-900">Territo</span>
          <div class="flex items-center gap-4">
            @if (auth.isAuthenticated()) {
              <span class="text-sm text-gray-500">{{ auth.currentUser()?.email }}</span>
              <button
                type="button"
                (click)="logout()"
                class="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Déconnexion
              </button>
            } @else {
              <a
                routerLink="/login"
                class="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Connexion
              </a>
            }
          </div>
        </div>
      </header>

      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="mb-10">
          <h2 class="text-2xl font-bold text-gray-900">
            Bonjour {{ auth.currentUser()?.email }} 👋
          </h2>
          <p class="mt-1 text-gray-500">Votre tableau de bord territorial</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <a
            routerLink="/map"
            class="bg-white rounded-2xl border border-gray-200 p-6 hover:border-indigo-300 hover:shadow-sm transition group"
          >
            <p class="text-sm text-gray-500 font-medium">Carte territoriale</p>
            <p class="text-sm text-indigo-600 font-semibold mt-3 group-hover:underline">Ouvrir la carte</p>
          </a>
          <a
            routerLink="/local-opportunities"
            class="bg-white rounded-2xl border border-gray-200 p-6 hover:border-indigo-300 hover:shadow-sm transition group"
          >
            <p class="text-sm text-gray-500 font-medium">Opportunités locales</p>
            <p class="text-sm text-indigo-600 font-semibold mt-3 group-hover:underline">Voir les zones en hausse</p>
          </a>
          <div class="bg-white rounded-2xl border border-gray-200 p-6">
            <p class="text-sm text-gray-500 font-medium">Alertes actives</p>
            <p class="text-3xl font-bold text-gray-900 mt-1">—</p>
          </div>
          <div class="bg-white rounded-2xl border border-gray-200 p-6">
            <p class="text-sm text-gray-500 font-medium">Plan</p>
            <p class="text-3xl font-bold text-gray-900 mt-1 capitalize">
              {{ auth.currentUser()?.role ?? '—' }}
            </p>
          </div>
        </div>
      </main>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  readonly auth = inject(UserStore);

  async logout() {
    await this.auth.logout();
  }
}
