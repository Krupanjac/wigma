import { Component, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/**
 * Login / Sign-up page component.
 *
 * Provides email+password auth and OAuth buttons (GitHub, Google).
 * Toggles between sign-in and sign-up mode.
 * Redirects to /projects on success via AuthService listener.
 */
@Component({
  selector: 'app-login',
  imports: [],
  template: `
    <div class="min-h-screen bg-[#1e1e1e] flex items-center justify-center">
      <div class="w-full max-w-md p-8">
        <!-- Logo -->
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-white tracking-tight">Wigma</h1>
          <p class="text-sm text-neutral-400 mt-1">Collaborative design tool</p>
        </div>

        <!-- Card -->
        <div class="bg-[#2d2d2d] rounded-xl border border-neutral-700 p-6 shadow-2xl">
          <h2 class="text-lg font-semibold text-white mb-4">
            {{ isSignUp() ? 'Create an account' : 'Sign in' }}
          </h2>

          <!-- Error -->
          @if (errorMessage()) {
            <div class="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {{ errorMessage() }}
            </div>
          }

          <!-- Form -->
          <form (submit)="onSubmit($event)" class="space-y-4">
            @if (isSignUp()) {
              <div>
                <label class="block text-sm text-neutral-300 mb-1" for="name">Name</label>
                <input
                  id="name"
                  type="text"
                  [value]="displayName()"
                  (input)="displayName.set(asInput($event).value)"
                  class="w-full px-3 py-2 bg-[#1e1e1e] border border-neutral-600 rounded-lg text-white text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Your name"
                  autocomplete="name"
                />
              </div>
            }

            <div>
              <label class="block text-sm text-neutral-300 mb-1" for="email">Email</label>
              <input
                id="email"
                type="email"
                [value]="email()"
                (input)="email.set(asInput($event).value)"
                class="w-full px-3 py-2 bg-[#1e1e1e] border border-neutral-600 rounded-lg text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@example.com"
                autocomplete="email"
                required
              />
            </div>

            <div>
              <label class="block text-sm text-neutral-300 mb-1" for="password">Password</label>
              <input
                id="password"
                type="password"
                [value]="password()"
                (input)="password.set(asInput($event).value)"
                class="w-full px-3 py-2 bg-[#1e1e1e] border border-neutral-600 rounded-lg text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                autocomplete="current-password"
                required
                minlength="6"
              />
            </div>

            <button
              type="submit"
              [disabled]="isSubmitting()"
              class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed
                     text-white text-sm font-medium rounded-lg transition-colors"
            >
              {{ isSubmitting() ? 'Please wait…' : (isSignUp() ? 'Create account' : 'Sign in') }}
            </button>
          </form>

          <!-- Divider -->
          <div class="flex items-center my-5">
            <div class="flex-1 h-px bg-neutral-600"></div>
            <span class="px-3 text-xs text-neutral-500">or continue with</span>
            <div class="flex-1 h-px bg-neutral-600"></div>
          </div>

          <!-- OAuth Buttons -->
          <div class="flex gap-3">
            <button
              (click)="signInWithOAuth('github')"
              class="flex-1 py-2 px-4 bg-[#1e1e1e] hover:bg-neutral-700 border border-neutral-600 rounded-lg
                     text-sm text-white transition-colors flex items-center justify-center gap-2"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57
                  0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695
                  -.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99
                  .105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225
                  -.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405
                  c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225
                  0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3
                  0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              GitHub
            </button>
            <button
              (click)="signInWithOAuth('google')"
              class="flex-1 py-2 px-4 bg-[#1e1e1e] hover:bg-neutral-700 border border-neutral-600 rounded-lg
                     text-sm text-white transition-colors flex items-center justify-center gap-2"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
          </div>

          <!-- Toggle -->
          <div class="mt-5 text-center text-sm text-neutral-400">
            @if (isSignUp()) {
              Already have an account?
              <button (click)="toggleMode()" class="text-blue-400 hover:text-blue-300 ml-1">Sign in</button>
            } @else {
              Don't have an account?
              <button (click)="toggleMode()" class="text-blue-400 hover:text-blue-300 ml-1">Sign up</button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly email = signal('');
  readonly password = signal('');
  readonly displayName = signal('');
  readonly isSignUp = signal(false);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  toggleMode(): void {
    this.isSignUp.update(v => !v);
    this.errorMessage.set(null);
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const { error } = this.isSignUp()
      ? await this.auth.signUp(this.email(), this.password(), this.displayName())
      : await this.auth.signIn(this.email(), this.password());

    this.isSubmitting.set(false);

    if (error) {
      this.errorMessage.set(error);
    } else {
      this.router.navigate(['/projects']);
    }
  }

  async signInWithOAuth(provider: 'github' | 'google'): Promise<void> {
    const { error } = await this.auth.signInWithOAuth(provider);
    if (error) {
      this.errorMessage.set(error);
    }
  }

  /** Helper to cast event target to input element. */
  asInput(event: Event): HTMLInputElement {
    return event.target as HTMLInputElement;
  }
}
