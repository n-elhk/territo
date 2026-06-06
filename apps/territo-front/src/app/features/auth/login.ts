import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { form, FormField, FormRoot, validateStandardSchema } from '@angular/forms/signals';
import { loginSchema } from '@territo/schemas';

import { UserStore } from '../../core/user.store';

@Component({
  selector: 'app-login',
  imports: [FormField, FormRoot, RouterLink],
  template: `
    <main class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-gray-900">Territo</h1>
          <p class="mt-2 text-gray-500">Connectez-vous à votre espace</p>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <form [formRoot]="loginForm">
            <div class="space-y-5">
              <div>
                <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  id="email"
                  type="email"
                  [formField]="loginForm.email"
                  autocomplete="email"
                  placeholder="vous@exemple.fr"
                  aria-required="true"
                  [attr.aria-describedby]="loginForm.email().touched() && loginForm.email().errors().length ? 'email-error' : null"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  [class.border-red-400]="loginForm.email().touched() && loginForm.email().errors().length"
                />
                @if (loginForm.email().touched() && loginForm.email().errors().length) {
                  <p id="email-error" class="mt-1 text-xs text-red-500" role="alert">
                    {{ loginForm.email().errors()[0].message }}
                  </p>
                }
              </div>

              <div>
                <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                <input
                  id="password"
                  type="password"
                  [formField]="loginForm.password"
                  autocomplete="current-password"
                  aria-required="true"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              @if (error()) {
                <p class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">{{ error() }}</p>
              }

              <button
                type="submit"
                [disabled]="loginForm().invalid() || loginForm().submitting()"
                [attr.aria-busy]="loginForm().submitting()"
                class="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors"
              >
                {{ loginForm().submitting() ? 'Connexion...' : 'Se connecter' }}
              </button>
            </div>
          </form>
        </div>

        <p class="text-center text-sm text-gray-500 mt-6">
          Pas encore de compte ?
          <a routerLink="/register" class="text-blue-600 hover:underline font-medium">Créer un compte</a>
        </p>
      </div>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly store = inject(UserStore);
  private readonly router = inject(Router);

  readonly error = signal<string | null>(null);

  private readonly model = signal({ email: '', password: '' });

  readonly loginForm = form(this.model, (s) => {
    validateStandardSchema(s.email, loginSchema.shape.email);
    validateStandardSchema(s.password, loginSchema.shape.password);
  }, {
    submission: {
      action: async () => {
        this.error.set(null);
        try {
          await this.store.login(this.model());
          await this.router.navigate(['/']);
        } catch {
          this.error.set('Email ou mot de passe incorrect.');
        }
      },
    },
  });
}
