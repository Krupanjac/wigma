import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import type { DbProject, ProjectInsert, ProjectUpdate, DocumentData, DbProjectUser } from '@wigma/shared';

/**
 * Project API service — CRUD operations for projects via Supabase.
 *
 * All queries go through Supabase RLS, so results are automatically
 * scoped to projects the current user has access to.
 *
 * Methods return `{ data, error }` tuples for consistent error handling.
 */
@Injectable({ providedIn: 'root' })
export class ProjectApiService {
  private readonly supa = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  /** List all projects the current user has access to. */
  async listProjects(): Promise<{ data: DbProject[]; error: string | null }> {
    const { data, error } = await this.withTimeout(
      this.supa.supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false }),
      10000,
    );

    return {
      data: (data as unknown as DbProject[]) ?? [],
      error: error?.message ?? null,
    };
  }

  /** Get a single project by ID. */
  async getProject(id: string): Promise<{ data: DbProject | null; error: string | null }> {
    const { data, error } = await this.withTimeout(
      this.supa.supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single(),
      10000,
    );

    return {
      data: (data as unknown as DbProject) ?? null,
      error: error?.message ?? null,
    };
  }

  /** Create a new project. Returns the created project. */
  async createProject(name: string = 'Untitled'): Promise<{ data: DbProject | null; error: string | null }> {
    const userId = this.auth.user()?.id;
    if (!userId) return { data: null, error: 'Not authenticated' };

    const insert: ProjectInsert = {
      name,
      owner_id: userId,
    };

    const { data, error } = await this.withTimeout(
      this.supa.supabase
        .from('projects')
        .insert(insert as any)
        .select()
        .single(),
      10000,
    );

    return {
      data: (data as unknown as DbProject) ?? null,
      error: error?.message ?? null,
    };
  }

  /** Update project metadata. */
  async updateProject(id: string, update: ProjectUpdate): Promise<{ error: string | null }> {
    const { error } = await this.withTimeout(
      (this.supa.supabase.from('projects') as any).update(update).eq('id', id),
      10000,
    );

    return { error: error?.message ?? null };
  }

  /** Delete a project (cascade deletes nodes, media, yjs data). */
  async deleteProject(id: string): Promise<{ error: string | null }> {
    const { error } = await this.withTimeout(
      this.supa.supabase.from('projects').delete().eq('id', id),
      10000,
    );

    return { error: error?.message ?? null };
  }

  /** Duplicate a project (metadata only — Yjs state is fresh). */
  async duplicateProject(id: string): Promise<{ data: DbProject | null; error: string | null }> {
    const { data: original, error: fetchError } = await this.getProject(id);
    if (fetchError || !original) return { data: null, error: fetchError };

    return this.createProject(`${original.name} (copy)`);
  }

  // ── Scene Graph Persistence ───────────────────────────────────────────

  // ── Link Sharing ──────────────────────────────────────────────────────

  /**
   * Toggle link-based sharing on/off for a project (owner only).
   * Calls the `set_link_sharing` RPC (SECURITY DEFINER).
   */
  async setLinkSharing(projectId: string, enabled: boolean): Promise<{ error: string | null }> {
    const { error } = await this.withTimeout(
      (this.supa.supabase.rpc as any)('set_link_sharing', {
        p_project_id: projectId,
        p_enabled: enabled,
      }),
      10000,
    );

    return { error: error?.message ?? null };
  }

  /**
   * Auto-join a link-shared project as editor.
   * Calls the `join_project_via_link` RPC (SECURITY DEFINER).
   * Returns true if the user was added (or was already a member).
   */
  async joinViaLink(projectId: string): Promise<{ joined: boolean; error: string | null }> {
    const { data, error } = await this.withTimeout(
      (this.supa.supabase.rpc as any)('join_project_via_link', {
        p_project_id: projectId,
      }),
      10000,
    );

    if (error) return { joined: false, error: error.message };
    return { joined: !!data, error: null };
  }

  // ── Project Sharing ───────────────────────────────────────────────────

  /** List all collaborators for a project. */
  async listProjectUsers(projectId: string): Promise<{ data: DbProjectUser[]; error: string | null }> {
    const { data, error } = await this.withTimeout(
      this.supa.supabase
        .from('project_users')
        .select('*')
        .eq('project_id', projectId)
        .order('invited_at', { ascending: true }),
      10000,
    );

    return {
      data: (data as unknown as DbProjectUser[]) ?? [],
      error: error?.message ?? null,
    };
  }

  /** Add a user to a project by email. Resolves email → user ID via RPC. */
  async addProjectUserByEmail(
    projectId: string,
    email: string,
    role: 'editor' | 'viewer' = 'editor',
  ): Promise<{ error: string | null }> {
    // Try to resolve via Supabase RPC (requires a `lookup_user_by_email` function)
    // Falls back to a clear error if not available.
    const { data, error: rpcError } = await this.withTimeout(
      (this.supa.supabase.rpc as any)('lookup_user_by_email', { lookup_email: email }),
      10000,
    );

    if (rpcError || !data) {
      // Graceful fallback — inform user that email invite needs server setup
      return {
        error: rpcError?.message ??
          'Email lookup is not configured. Share the project link instead, or invite by user ID.',
      };
    }

    const userId = typeof data === 'string' ? data : (data as any)?.id;
    if (!userId) return { error: 'No user found with that email address' };

    return this.addProjectUser(projectId, userId, role);
  }

  /** Add a user to a project by user ID. */
  async addProjectUser(
    projectId: string,
    userId: string,
    role: 'editor' | 'viewer' = 'editor',
  ): Promise<{ error: string | null }> {
    const { error } = await this.withTimeout(
      this.supa.supabase
        .from('project_users')
        .upsert(
          { project_id: projectId, user_id: userId, role } as any,
          { onConflict: 'project_id,user_id' },
        ),
      10000,
    );

    return { error: error?.message ?? null };
  }

  /** Remove a user from a project. */
  async removeProjectUser(projectId: string, userId: string): Promise<{ error: string | null }> {
    const { error } = await this.withTimeout(
      this.supa.supabase
        .from('project_users')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId),
      10000,
    );

    return { error: error?.message ?? null };
  }

  /** Update a collaborator's role. */
  async updateProjectUserRole(
    projectId: string,
    userId: string,
    role: 'editor' | 'viewer',
  ): Promise<{ error: string | null }> {
    const { error } = await this.withTimeout(
      (this.supa.supabase.from('project_users') as any)
        .update({ role })
        .eq('project_id', projectId)
        .eq('user_id', userId),
      10000,
    );

    return { error: error?.message ?? null };
  }

  // ── Scene Graph Persistence (continued) ───────────────────────────────

  /** Save the full document scene graph to the project_data JSONB column. */
  async saveProjectData(id: string, docData: DocumentData): Promise<{ error: string | null }> {
    const { error } = await this.withTimeout(
      (this.supa.supabase.from('projects') as any)
        .update({ project_data: docData, updated_at: new Date().toISOString() })
        .eq('id', id),
      15000,
    );

    return { error: error?.message ?? null };
  }

  /** Load the scene graph data from a project. Returns null if empty. */
  async loadProjectData(id: string): Promise<{ data: DocumentData | null; error: string | null }> {
    const { data, error } = await this.withTimeout(
      this.supa.supabase
        .from('projects')
        .select('project_data')
        .eq('id', id)
        .single(),
      10000,
    );

    if (error) return { data: null, error: error.message };

    const row = data as unknown as { project_data: DocumentData | null };
    return { data: row?.project_data ?? null, error: null };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Race a Supabase query against a timeout.
   * If the query doesn't resolve within `ms`, returns a synthetic error.
   */
  private withTimeout<T extends { data: any; error: any }>(
    query: PromiseLike<T>,
    ms: number,
  ): Promise<T> {
    return Promise.race([
      query,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Supabase query timed out after ${ms}ms`)), ms),
      ),
    ]).catch((err) => {
      console.error('[ProjectApi]', err.message ?? err);
      return { data: null, error: { message: err.message ?? 'Query timed out' } } as unknown as T;
    });
  }
}
