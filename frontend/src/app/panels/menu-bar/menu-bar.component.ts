import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProjectService } from '../../core/services/project.service';
import { CollabProvider } from '../../core/services/collab-provider.service';
import { ShareDialogComponent } from '../share-dialog/share-dialog.component';

@Component({
  selector: 'app-menu-bar',
  imports: [RouterLink, ShareDialogComponent],
  templateUrl: './menu-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuBarComponent {
  readonly project = inject(ProjectService);
  readonly collabProvider = inject(CollabProvider);

  readonly showShareDialog = signal(false);

  /** First 4 peer avatars with initials. */
  readonly peerAvatars = computed(() => {
    const peers = this.collabProvider.remotePeers();
    return Array.from(peers.values())
      .slice(0, 4)
      .map(p => ({
        u: p.u,
        n: p.n,
        cl: p.cl,
        initial: (p.n?.[0] ?? '?').toUpperCase(),
      }));
  });

  /** Overflow count beyond 4 displayed avatars. */
  readonly overflowCount = computed(() =>
    Math.max(0, this.collabProvider.peerCount() - 4),
  );
}
