import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EditorComponent } from '../../editor.component';
import { ProjectApiService } from '../../core/services/project-api.service';
import { ProjectService } from '../../core/services/project.service';
import type { DbProject } from '@wigma/shared';

/**
 * Editor shell — wraps the EditorComponent with route-based project loading.
 *
 * This component:
 *   1. Reads project ID from the route parameter
 *   2. Fetches project metadata from Supabase
 *   3. Passes project context to ProjectService.setRemoteProject()
 *   4. Renders the EditorComponent which contains the full editor UI
 *
 * The EditorComponent remains the single source of truth for the editor canvas,
 * tools, panels, and keybindings. EditorShell is just the route entry point.
 */
@Component({
  selector: 'app-editor-shell',
  imports: [EditorComponent],
  template: `
    @if (isLoading()) {
      <div class="flex items-center justify-center h-screen bg-[#1e1e1e]">
        <div class="text-center">
          <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p class="text-sm text-neutral-400">Loading project…</p>
        </div>
      </div>
    } @else if (errorMessage()) {
      <div class="flex items-center justify-center h-screen bg-[#1e1e1e]">
        <div class="text-center max-w-md px-6">
          <p class="text-red-400 mb-4">{{ errorMessage() }}</p>
          <button
            (click)="goBack()"
            class="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-sm text-white"
          >
            Back to projects
          </button>
        </div>
      </div>
    } @else {
      <app-editor />
    }
  `,
})
export class EditorShellComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectApi = inject(ProjectApiService);
  private readonly projectService = inject(ProjectService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  private projectId: string | null = null;

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id');

    if (!this.projectId) {
      this.errorMessage.set('No project ID specified');
      this.isLoading.set(false);
      return;
    }

    this.loadProject(this.projectId);
  }

  ngOnDestroy(): void {
    this.projectService.clearRemoteProject();
  }

  goBack(): void {
    this.router.navigate(['/projects']);
  }

  private async loadProject(id: string): Promise<void> {
    try {
      const { data, error } = await this.projectApi.getProject(id);

      if (error || !data) {
        this.errorMessage.set(error ?? 'Project not found');
        this.isLoading.set(false);
        return;
      }

      // Set the remote project context so ProjectService knows where to save
      this.projectService.setRemoteProject(data);

      // Load the scene graph from Supabase (if it exists)
      // This waits for the engine to be ready, then loads
      await this.loadSceneWhenReady(id);

      this.isLoading.set(false);
    } catch (err: any) {
      console.error('[EditorShell] loadProject error:', err);
      this.errorMessage.set(err?.message ?? 'Failed to load project');
      this.isLoading.set(false);
    }
  }

  /**
   * Wait for the engine to be initialized, then load scene data from Supabase.
   * The engine is created by EditorComponent.ngAfterViewInit, which happens
   * after isLoading becomes false. So we set isLoading=false first, then wait
   * for the engine.
   */
  private async loadSceneWhenReady(projectId: string): Promise<void> {
    // The actual scene loading happens after the editor component mounts.
    // We use a microtask loop to wait for the engine to be ready.
    this.isLoading.set(false);

    const maxAttempts = 50; // 5 seconds max
    let attempts = 0;

    await new Promise<void>((resolve) => {
      const check = () => {
        // ProjectService.engine is set by ProjectService.init() which is called by EditorComponent
        if ((this.projectService as any).engine || ++attempts >= maxAttempts) {
          resolve();
          return;
        }
        setTimeout(check, 100);
      };
      check();
    });

    // Now load the remote data
    await this.projectService.loadFromRemote(projectId);
  }
}
