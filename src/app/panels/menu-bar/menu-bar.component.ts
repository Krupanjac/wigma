import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ProjectService } from '../../core/services/project.service';

@Component({
  selector: 'app-menu-bar',
  imports: [],
  templateUrl: './menu-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuBarComponent {
  readonly project = inject(ProjectService);
}
