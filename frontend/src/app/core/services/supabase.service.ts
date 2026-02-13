import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
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
