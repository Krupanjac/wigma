import { Injectable, signal, computed, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import type { User, Session, AuthChangeEvent, Subscription } from '@supabase/supabase-js';
import type { DbProfile, ProfileUpdate } from '@wigma/shared';

/**
 * Authentication service — wraps Supabase Auth with Angular signals.
 *
 * State management:
 *   - `user` signal: current authenticated user (null = logged out)
 *   - `session` signal: current JWT session (null = no session)
 *   - `profile` signal: user profile from profiles table
 *   - `isAuthenticated` computed: boolean shorthand
 *   - `isLoading` signal: true during initial session restoration
 *
 * Auth flow:
 *   1. On init, subscribe to onAuthStateChange
 *   2. On SIGNED_IN → fetch profile, set signals
 *   3. On SIGNED_OUT → clear signals, redirect to /login
 *   4. Token refresh handled automatically by Supabase SDK
 */
@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  /** Current authenticated user. */
  readonly user = signal<User | null>(null);

  /** Current session (contains JWT). */
  readonly session = signal<Session | null>(null);

  /** User profile from profiles table. */
  readonly profile = signal<DbProfile | null>(null);

  /** True while restoring session on app load. */
  readonly isLoading = signal(true);

  /** Derived authentication state. */
  readonly isAuthenticated = computed(() => this.user() !== null);

  private authSubscription: Subscription | null = null;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly router: Router,
  ) {
    this.initAuthListener();
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
  }

  // ── Auth Actions ──────────────────────────────────────────────────────────

  /** Sign up with email and password. */
  async signUp(email: string, password: string, displayName: string): Promise<{ error: string | null }> {
    const { error } = await this.supabaseService.supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: displayName },
      },
    });
    return { error: error?.message ?? null };
  }

  /** Sign in with email and password. */
  async signIn(email: string, password: string): Promise<{ error: string | null }> {
    const { error } = await this.supabaseService.supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error?.message ?? null };
  }

  /** Sign in with OAuth provider (GitHub, Google). */
  async signInWithOAuth(provider: 'github' | 'google'): Promise<{ error: string | null }> {
    const { error } = await this.supabaseService.supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/projects`,
      },
    });
    return { error: error?.message ?? null };
  }

  /** Sign out and redirect to login. */
  async signOut(): Promise<void> {
    await this.supabaseService.supabase.auth.signOut();
    this.user.set(null);
    this.session.set(null);
    this.profile.set(null);
    this.router.navigate(['/login']);
  }

  /** Update the user's profile. */
  async updateProfile(update: ProfileUpdate): Promise<{ error: string | null }> {
    const userId = this.user()?.id;
    if (!userId) return { error: 'Not authenticated' };

    const { error } = await (this.supabaseService.supabase
      .from('profiles') as any)
      .update(update)
      .eq('id', userId);

    if (!error) {
      // Refresh profile signal
      const current = this.profile();
      if (current) {
        this.profile.set({ ...current, ...update } as DbProfile);
      }
    }

    return { error: error?.message ?? null };
  }

  /** Get current access token for WebSocket auth. */
  async getAccessToken(): Promise<string | null> {
    const { data } = await this.supabaseService.supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private initAuthListener(): void {
    // Subscribe to auth state changes
    const { data } = this.supabaseService.supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        this.session.set(session);
        this.user.set(session?.user ?? null);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            await this.fetchProfile(session.user.id);
          }
        }

        if (event === 'SIGNED_OUT') {
          this.profile.set(null);
        }

        this.isLoading.set(false);
      }
    );

    this.authSubscription = data.subscription;

    // Also check for an existing session on startup
    this.restoreSession();
  }

  private async restoreSession(): Promise<void> {
    const { data } = await this.supabaseService.supabase.auth.getSession();
    if (data.session) {
      this.session.set(data.session);
      this.user.set(data.session.user);
      await this.fetchProfile(data.session.user.id);
    }
    this.isLoading.set(false);
  }

  private async fetchProfile(userId: string): Promise<void> {
    const { data, error } = await this.supabaseService.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      this.profile.set(data as unknown as DbProfile);
    }
  }
}
