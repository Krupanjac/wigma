import { Injectable, signal, computed, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import type { User, Session, AuthChangeEvent, Subscription } from '@supabase/supabase-js';

/**
 * Authentication service — wraps Supabase Auth with Angular signals.
 *
 * All user data comes from Supabase auth.users (user_metadata).
 * No separate profiles table is needed.
 *
 * State management:
 *   - `user` signal: current authenticated user (null = logged out)
 *   - `session` signal: current JWT session (null = no session)
 *   - `displayName` computed: user display name from user_metadata or email
 *   - `avatarUrl` computed: avatar URL from user_metadata
 *   - `isAuthenticated` computed: boolean shorthand
 *   - `isLoading` signal: true during initial session restoration
 *
 * Auth flow:
 *   1. On init, subscribe to onAuthStateChange
 *   2. On SIGNED_IN → set signals
 *   3. On SIGNED_OUT → clear signals, redirect to /login
 *   4. Token refresh handled automatically by Supabase SDK
 */
@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  /** Current authenticated user. */
  readonly user = signal<User | null>(null);

  /** Current session (contains JWT). */
  readonly session = signal<Session | null>(null);

  /** True while restoring session on app load. */
  readonly isLoading = signal(true);

  /** Display name derived from user_metadata or email. */
  readonly displayName = computed(() => {
    const u = this.user();
    if (!u) return null;
    return u.user_metadata?.['full_name'] ?? u.email?.split('@')[0] ?? 'User';
  });

  /** Avatar URL from user_metadata. */
  readonly avatarUrl = computed(() => this.user()?.user_metadata?.['avatar_url'] ?? null);

  /** Derived authentication state. */
  readonly isAuthenticated = computed(() => this.user() !== null);

  private authSubscription: Subscription | null = null;
  private initialSessionHandled = false;

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
    this.router.navigate(['/login']);
  }

  /** Update the user's display name / avatar via Supabase Auth user_metadata. */
  async updateUserMeta(update: { full_name?: string; avatar_url?: string }): Promise<{ error: string | null }> {
    const { error } = await this.supabaseService.supabase.auth.updateUser({
      data: update,
    });

    if (!error) {
      // Refresh user signal with updated metadata
      const { data } = await this.supabaseService.supabase.auth.getUser();
      if (data.user) this.user.set(data.user);
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
      (event: AuthChangeEvent, session: Session | null) => {
        console.debug('[Auth] onAuthStateChange:', event, session?.user?.email ?? 'no user');

        this.session.set(session);
        this.user.set(session?.user ?? null);

        // Unblock guards and UI IMMEDIATELY
        this.initialSessionHandled = true;
        this.isLoading.set(false);
      }
    );

    this.authSubscription = data.subscription;

    // Fallback: if onAuthStateChange doesn't fire within 2s, force-resolve.
    // This handles the edge case where there's no stored session at all.
    setTimeout(() => {
      if (!this.initialSessionHandled) {
        console.debug('[Auth] onAuthStateChange timeout — forcing isLoading=false');
        this.initialSessionHandled = true;
        this.isLoading.set(false);
      }
    }, 2000);
  }

  private async restoreSession(): Promise<void> {
    // No longer called — kept for potential manual use
    try {
      const { data, error } = await this.supabaseService.supabase.auth.getSession();
      if (error) {
        console.warn('[Auth] restoreSession error:', error.message);
      } else if (data.session) {
        this.session.set(data.session);
        this.user.set(data.session.user);
      }
    } catch (e) {
      console.error('[Auth] restoreSession exception:', e);
    } finally {
      this.isLoading.set(false);
    }
  }
}
