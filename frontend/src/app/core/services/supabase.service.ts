import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, type LockFunc } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import type { Database } from '@wigma/shared';

/**
 * Singleton Supabase client wrapper.
 *
 * Provides a typed Supabase client instance configured with the
 * project URL and anon key from environment. All other services
 * inject this to access auth, database, and storage.
 *
 * The client handles JWT refresh automatically via the GoTrue
 * auth module — no manual token management needed.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly client: SupabaseClient<Database>;

  constructor() {
    this.client = createClient<Database>(
      environment.supabaseUrl,
      environment.supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storage: globalThis.localStorage,
          storageKey: 'wigma.auth.token',
          flowType: 'implicit',
          lock: silentNavigatorLock,
        },
        realtime: {
          params: { eventsPerSecond: 10 },
        },
      }
    );
  }

  /** Get the typed Supabase client. */
  get supabase(): SupabaseClient<Database> {
    return this.client;
  }
}

/**
 * Custom Navigator Lock wrapper that never throws.
 *
 * The default Supabase lock implementation throws LockAcquireTimeoutError
 * when the lock can't be acquired immediately (`ifAvailable: true`).
 * Zone.js (Angular) surfaces these internally-caught rejections as
 * console errors. This implementation silently falls through instead.
 */
const silentNavigatorLock: LockFunc = async (
  name: string,
  acquireTimeout: number,
  fn: () => Promise<any>,
) => {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    // No Navigator Locks API (SSR, old browser) — just run directly
    return await fn();
  }

  if (acquireTimeout === 0) {
    // "Immediately" mode — try to grab the lock, run fn() regardless
    const result = await navigator.locks.request(
      name,
      { ifAvailable: true },
      async (lock) => {
        if (lock) {
          return await fn();
        }
        // Lock held by another tab/context — run without lock
        return await fn();
      },
    );
    return result;
  }

  // Timed mode — race between lock acquisition and timeout
  return await new Promise<any>((resolve, reject) => {
    const ac = new AbortController();
    const timer = setTimeout(() => {
      ac.abort();
      // On timeout, run fn() without holding the lock
      fn().then(resolve, reject);
    }, acquireTimeout);

    navigator.locks
      .request(name, { signal: ac.signal }, async () => {
        clearTimeout(timer);
        return await fn();
      })
      .then(resolve)
      .catch((err) => {
        clearTimeout(timer);
        // AbortError is expected when our timer fires — already handled above
        if (err.name !== 'AbortError') {
          fn().then(resolve, reject);
        }
      });
  });
};
