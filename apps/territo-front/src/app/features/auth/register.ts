import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { form, FormField, FormRoot, required, email as emailRule, minLength } from '@angular/forms/signals';

import { UserStore } from '../../core/user.store';

@Component({
  selector: 'app-register',
  imports: [FormField, FormRoot, RouterLink],
  template: `
    <main class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-gray-900">Territo</h1>
          <p class="mt-2 text-gray-500">Créez votre compte</p>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <form [formRoot]="registerForm">
            <div class="space-y-5">
              <div>
                <label for="name" class="block text-sm font-medium text-gray-700 mb-1">
                  Nom <span class="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <input
                  id="name"
                  type="text"
                  [formField]="registerForm.name"
                  autocomplete="name"
                  placeholder="Jean Dupont"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  id="email"
                  type="email"
                  [formField]="registerForm.email"
                  autocomplete="email"
                  placeholder="vous@exemple.fr"
                  aria-required="true"
                  [attr.aria-describedby]="registerForm.email().touched() && registerForm.email().errors().length ? 'email-error' : null"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  [class.border-red-400]="registerForm.email().touched() && registerForm.email().errors().length"
                />
                @if (registerForm.email().touched() && registerForm.email().errors().length) {
                  <p id="email-error" class="mt-1 text-xs text-red-500" role="alert">
                    {{ registerForm.email().errors()[0].message }}
                  </p>
                }
              </div>

              <div>
                <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                <input
                  id="password"
                  type="password"
                  [formField]="registerForm.password"
                  autocomplete="new-password"
                  aria-required="true"
                  [attr.aria-describedby]="registerForm.password().touched() && registerForm.password().errors().length ? 'password-error' : null"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  [class.border-red-400]="registerForm.password().touched() && registerForm.password().errors().length"
                />
                @if (registerForm.password().touched() && registerForm.password().errors().length) {
                  <p id="password-error" class="mt-1 text-xs text-red-500" role="alert">8 caractères minimum.</p>
                }
              </div>

              @if (error()) {
                <p class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">{{ error() }}</p>
              }

              <button
                type="submit"
                [disabled]="registerForm().invalid() || registerForm().submitting()"
                [attr.aria-busy]="registerForm().submitting()"
                class="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors"
              >
                {{ registerForm().submitting() ? 'Création...' : 'Créer mon compte' }}
              </button>
            </div>
          </form>
        </div>

        <p class="text-center text-sm text-gray-500 mt-6">
          Déjà un compte ?
          <a routerLink="/login" class="text-blue-600 hover:underline font-medium">Se connecter</a>
        </p>
      </div>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  private readonly store = inject(UserStore);
  private readonly router = inject(Router);

  readonly error = signal<string | null>(null);

  private readonly model = signal({ name: '', email: '', password: '' });

  readonly registerForm = form(this.model, (s) => {
    required(s.email, { message: 'Email requis' });
    emailRule(s.email, { message: 'Email invalide' });
    required(s.password, { message: 'Mot de passe requis' });
    minLength(s.password, 8);
  }, {
    submission: {
      action: async () => {
        this.error.set(null);
        try {
          const m = this.model();
          await this.store.register(m.email, m.password, m.name || undefined);
          await this.router.navigate(['/']);
        } catch {
          this.error.set('Impossible de créer le compte. Email déjà utilisé ?');
        }
      },
    },
  });
}
