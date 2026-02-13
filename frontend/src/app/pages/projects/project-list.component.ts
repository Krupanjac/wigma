import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProjectApiService } from '../../core/services/project-api.service';
import type { DbProject } from '@wigma/shared';

/**
 * Project list / dashboard page.
 *
 * Shows all projects the user has access to in a responsive grid.
 * Provides create, rename, duplicate, and delete actions.
 */
@Component({
  selector: 'app-project-list',
  template: `
    <div class="min-h-screen bg-[#1e1e1e] text-white">
      <!-- Header -->
      <header class="border-b border-neutral-700 bg-[#252525]">
        <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 class="text-xl font-bold tracking-tight">Wigma</h1>
          <div class="flex items-center gap-4">
            <span class="text-sm text-neutral-400">{{ auth.profile()?.display_name || auth.user()?.email }}</span>
            <button
              (click)="auth.signOut()"
              class="px-3 py-1.5 text-sm bg-neutral-700 hover:bg-neutral-600 rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <!-- Content -->
      <main class="max-w-7xl mx-auto px-6 py-8">
        <!-- Title + Create -->
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-semibold">Your projects</h2>
          <button
            (click)="createProject()"
            [disabled]="isCreating()"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50
                   text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path d="M12 4v16m8-8H4"/>
            </svg>
            New project
          </button>
        </div>

        <!-- Loading -->
        @if (isLoading()) {
          <div class="flex items-center justify-center py-20">
            <div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        }

        <!-- Error -->
        @if (errorMessage()) {
          <div class="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {{ errorMessage() }}
          </div>
        }

        <!-- Empty state -->
        @if (!isLoading() && projects().length === 0) {
          <div class="text-center py-20">
            <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-neutral-800 flex items-center justify-center">
              <svg class="w-8 h-8 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
              </svg>
            </div>
            <p class="text-neutral-400 mb-1">No projects yet</p>
            <p class="text-neutral-500 text-sm">Create your first project to get started.</p>
          </div>
        }

        <!-- Project Grid -->
        @if (!isLoading() && projects().length > 0) {
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            @for (project of projects(); track project.id) {
              <div
                class="group bg-[#2d2d2d] rounded-xl border border-neutral-700 hover:border-neutral-500
                       transition-colors cursor-pointer overflow-hidden"
                (click)="openProject(project.id)"
              >
                <!-- Thumbnail -->
                <div class="aspect-[16/10] bg-[#1a1a1a] flex items-center justify-center relative">
                  @if (project.thumbnail_path) {
                    <img [src]="project.thumbnail_path" class="w-full h-full object-cover" alt="" />
                  } @else {
                    <svg class="w-10 h-10 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                    </svg>
                  }

                  <!-- Actions overlay -->
                  <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      (click)="duplicateProject(project, $event)"
                      class="p-1.5 bg-neutral-800/80 hover:bg-neutral-700 rounded-md"
                      title="Duplicate"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                      </svg>
                    </button>
                    <button
                      (click)="deleteProject(project, $event)"
                      class="p-1.5 bg-neutral-800/80 hover:bg-red-600 rounded-md"
                      title="Delete"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Info -->
                <div class="p-3">
                  <p class="text-sm font-medium truncate">{{ project.name }}</p>
                  <p class="text-xs text-neutral-500 mt-0.5">
                    {{ formatDate(project.updated_at) }}
                  </p>
                </div>
              </div>
            }
          </div>
        }
      </main>
    </div>
  `,
})
export class ProjectListComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly router = inject(Router);

  readonly projects = signal<DbProject[]>([]);
  readonly isLoading = signal(true);
  readonly isCreating = signal(false);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadProjects();
  }

  async loadProjects(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { data, error } = await this.projectApi.listProjects();

    this.projects.set(data);
    this.errorMessage.set(error);
    this.isLoading.set(false);
  }

  async createProject(): Promise<void> {
    this.isCreating.set(true);

    const { data, error } = await this.projectApi.createProject();

    this.isCreating.set(false);

    if (error) {
      this.errorMessage.set(error);
      return;
    }

    if (data) {
      this.router.navigate(['/project', data.id]);
    }
  }

  openProject(id: string): void {
    this.router.navigate(['/project', id]);
  }

  async duplicateProject(project: DbProject, event: Event): Promise<void> {
    event.stopPropagation();

    const { data, error } = await this.projectApi.duplicateProject(project.id);
    if (error) {
      this.errorMessage.set(error);
      return;
    }

    if (data) {
      this.projects.update(list => [data, ...list]);
    }
  }

  async deleteProject(project: DbProject, event: Event): Promise<void> {
    event.stopPropagation();

    if (!confirm(`Delete "${project.name}"? This can't be undone.`)) return;

    const { error } = await this.projectApi.deleteProject(project.id);
    if (error) {
      this.errorMessage.set(error);
      return;
    }

    this.projects.update(list => list.filter(p => p.id !== project.id));
  }

  formatDate(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
