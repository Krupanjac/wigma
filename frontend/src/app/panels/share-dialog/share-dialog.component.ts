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

        <!-- Copy link -->
        <div class="border-b border-zinc-800 px-5 py-3">
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
          <p class="mt-1.5 text-[11px] text-zinc-500">
            Anyone with this link who has been invited can collaborate in real time.
          </p>
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

  readonly shareLink = signal('');
  readonly linkCopied = signal(false);
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
