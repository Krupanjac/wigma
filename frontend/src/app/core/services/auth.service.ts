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
      (event: AuthChangeEvent, session: Session | null) => {
        console.debug('[Auth] onAuthStateChange:', event, session?.user?.email ?? 'no user');

        this.session.set(session);
        this.user.set(session?.user ?? null);

        if (event === 'SIGNED_OUT') {
          this.profile.set(null);
        }

        // Unblock guards and UI IMMEDIATELY — don't wait for profile fetch
        this.initialSessionHandled = true;
        this.isLoading.set(false);

        // Fetch profile in background (non-blocking)
        if (
          (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') &&
          session?.user
        ) {
          this.fetchProfile(session.user.id);
        }
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
        this.fetchProfile(data.session.user.id);
      }
    } catch (e) {
      console.error('[Auth] restoreSession exception:', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async fetchProfile(userId: string): Promise<void> {
    try {
      const result: { data: any; error: any } = await Promise.race([
        this.supabaseService.supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('fetchProfile timed out after 8s')), 8000),
        ),
      ]);

      if (result.error) {
        console.warn('[Auth] fetchProfile error:', result.error.message);
        return;
      }

      if (result.data) {
        this.profile.set(result.data as unknown as DbProfile);
        return;
      }

      // Profile row doesn't exist — auto-create it
      console.debug('[Auth] No profile found, creating one for', userId);
      const user = this.user();
      const { data: created, error: insertErr } = await this.supabaseService.supabase
        .from('profiles')
        .insert({
          id: userId,
          display_name: user?.user_metadata?.['full_name'] ?? user?.email ?? 'User',
          avatar_url: user?.user_metadata?.['avatar_url'] ?? null,
        } as any)
        .select()
        .single();

      if (insertErr) {
        console.warn('[Auth] auto-create profile error:', insertErr.message);
      } else if (created) {
        this.profile.set(created as unknown as DbProfile);
      }
    } catch (e: any) {
      console.error('[Auth] fetchProfile exception:', e?.message ?? e);
    }
  }
}
