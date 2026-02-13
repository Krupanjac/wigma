import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import type { DbProject, ProjectInsert, ProjectUpdate } from '@wigma/shared';

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
    const { data, error } = await this.supa.supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });

    return {
      data: (data as unknown as DbProject[]) ?? [],
      error: error?.message ?? null,
    };
  }

  /** Get a single project by ID. */
  async getProject(id: string): Promise<{ data: DbProject | null; error: string | null }> {
    const { data, error } = await this.supa.supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

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

    const { data, error } = await this.supa.supabase
      .from('projects')
      .insert(insert as any)
      .select()
      .single();

    return {
      data: (data as unknown as DbProject) ?? null,
      error: error?.message ?? null,
    };
  }

  /** Update project metadata. */
  async updateProject(id: string, update: ProjectUpdate): Promise<{ error: string | null }> {
    const { error } = await (this.supa.supabase
      .from('projects') as any)
      .update(update)
      .eq('id', id);

    return { error: error?.message ?? null };
  }

  /** Delete a project (cascade deletes nodes, media, yjs data). */
  async deleteProject(id: string): Promise<{ error: string | null }> {
    const { error } = await this.supa.supabase
      .from('projects')
      .delete()
      .eq('id', id);

    return { error: error?.message ?? null };
  }

  /** Duplicate a project (metadata only — Yjs state is fresh). */
  async duplicateProject(id: string): Promise<{ data: DbProject | null; error: string | null }> {
    const { data: original, error: fetchError } = await this.getProject(id);
    if (fetchError || !original) return { data: null, error: fetchError };

    return this.createProject(`${original.name} (copy)`);
  }
}
