import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProjectApiService } from '../../core/services/project-api.service';
import { ProjectService } from '../../core/services/project.service';
import { AuthService } from '../../core/services/auth.service';
import { CollabProvider } from '../../core/services/collab-provider.service';
import type { DbProjectUser } from '@wigma/shared';

@Component({
  selector: 'app-share-dialog',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm pt-20"
      (click)="close.emit()"
    >
      <!-- Dialog -->
      <div
        class="w-[420px] rounded-xl border border-zinc-700/60 bg-zinc-900 shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 class="text-sm font-semibold text-white">Share project</h2>
          <button
            (click)="close.emit()"
            class="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <!-- Link sharing toggle -->
        <div class="border-b border-zinc-800 px-5 py-3">
          @if (isOwner()) {
            <div class="flex items-center justify-between mb-2">
              <div>
                <span class="text-xs font-medium text-zinc-300">Anyone with the link</span>
                <p class="text-[11px] text-zinc-500 mt-0.5">
                  {{ linkSharing() ? 'Anyone with the link can open and edit this project' : 'Only invited members can access this project' }}
                </p>
              </div>
              <button
                (click)="toggleLinkSharing()"
                [disabled]="togglingLink()"
                class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50"
                [class]="linkSharing() ? 'bg-blue-600' : 'bg-zinc-700'"
              >
                <span
                  class="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out"
                  [class]="linkSharing() ? 'translate-x-4' : 'translate-x-0'"
                ></span>
              </button>
            </div>
          }
          <div class="flex items-center gap-2">
            <input
              readonly
              [value]="shareLink()"
              class="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-blue-500"
            />
            <button
              (click)="copyLink()"
              class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              [class]="linkCopied() ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-500'"
            >
              {{ linkCopied() ? 'Copied!' : 'Copy link' }}
            </button>
          </div>
        </div>

        <!-- Invite by email -->
        <div class="border-b border-zinc-800 px-5 py-3">
          <label class="mb-1.5 block text-xs font-medium text-zinc-400">Invite by email</label>
          <form (submit)="invite($event)" class="flex items-center gap-2">
            <input
              [(ngModel)]="inviteEmail"
              name="email"
              type="email"
              placeholder="colleague@company.com"
              class="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-blue-500"
            />
            <select
              [(ngModel)]="inviteRole"
              name="role"
              class="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300 outline-none"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              type="submit"
              [disabled]="inviting()"
              class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {{ inviting() ? 'Inviting…' : 'Invite' }}
            </button>
          </form>
          @if (inviteError()) {
            <p class="mt-1.5 text-[11px] text-red-400">{{ inviteError() }}</p>
          }
          @if (inviteSuccess()) {
            <p class="mt-1.5 text-[11px] text-green-400">{{ inviteSuccess() }}</p>
          }
        </div>

        <!-- Connected peers -->
        <div class="px-5 py-3">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-xs font-medium text-zinc-400">Currently online</span>
            <span class="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
              {{ collabProvider.peerCount() + 1 }}
            </span>
          </div>

          @if (collabProvider.peerCount() === 0) {
            <p class="text-[11px] text-zinc-600">No other collaborators online</p>
          } @else {
            <div class="space-y-1.5 max-h-32 overflow-y-auto">
              @for (peer of peerList(); track peer.u) {
                <div class="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-zinc-800/50">
                  <div
                    class="h-2 w-2 rounded-full"
                    [style.background-color]="peer.cl"
                  ></div>
                  <span class="text-xs text-zinc-300">{{ peer.n }}</span>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class ShareDialogComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  readonly collabProvider = inject(CollabProvider);
  private readonly projectApi = inject(ProjectApiService);
  private readonly projectService = inject(ProjectService);
  private readonly auth = inject(AuthService);

  readonly shareLink = signal('');
  readonly linkCopied = signal(false);
  readonly linkSharing = signal(false);
  readonly togglingLink = signal(false);
  readonly isOwner = signal(false);
  readonly inviting = signal(false);
  readonly inviteError = signal<string | null>(null);
  readonly inviteSuccess = signal<string | null>(null);
  readonly peerList = signal<Array<{ u: string; n: string; cl: string }>>([]);

  inviteEmail = '';
  inviteRole: 'editor' | 'viewer' = 'editor';

  ngOnInit(): void {
    const project = this.projectService.remoteProject();
    if (project?.id) {
      this.shareLink.set(`${window.location.origin}/project/${project.id}`);
      this.linkSharing.set(project.link_sharing ?? false);
      this.isOwner.set(project.owner_id === this.auth.user()?.id);
    }

    // Snapshot peers for display
    this.updatePeerList();
  }

  copyLink(): void {
    navigator.clipboard.writeText(this.shareLink()).then(() => {
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    });
  }

  async toggleLinkSharing(): Promise<void> {
    const project = this.projectService.remoteProject();
    if (!project?.id) return;

    const newValue = !this.linkSharing();
    this.togglingLink.set(true);

    const { error } = await this.projectApi.setLinkSharing(project.id, newValue);

    this.togglingLink.set(false);

    if (!error) {
      this.linkSharing.set(newValue);
      // Update the cached project so other components see the change
      this.projectService.setRemoteProject({ ...project, link_sharing: newValue });
    } else {
      console.error('[ShareDialog] toggleLinkSharing failed:', error);
    }
  }

  async invite(event: Event): Promise<void> {
    event.preventDefault();
    const email = this.inviteEmail.trim();
    if (!email) return;

    const projectId = this.projectService.remoteProject()?.id;
    if (!projectId) {
      this.inviteError.set('No project loaded');
      return;
    }

    this.inviting.set(true);
    this.inviteError.set(null);
    this.inviteSuccess.set(null);

    const { error } = await this.projectApi.addProjectUserByEmail(projectId, email, this.inviteRole);

    this.inviting.set(false);

    if (error) {
      this.inviteError.set(error);
    } else {
      this.inviteSuccess.set(`Invited ${email} as ${this.inviteRole}`);
      this.inviteEmail = '';
      setTimeout(() => this.inviteSuccess.set(null), 3000);
    }
  }

  private updatePeerList(): void {
    const peers = this.collabProvider.remotePeers();
    this.peerList.set(Array.from(peers.values()).map(p => ({ u: p.u, n: p.n, cl: p.cl })));
  }
}
