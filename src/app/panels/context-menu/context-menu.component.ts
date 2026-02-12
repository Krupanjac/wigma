import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { ContextMenuActionItem } from './context-menu.model';
import { ContextMenuService } from './context-menu.service';

@Component({
  selector: 'app-context-menu',
  imports: [],
  templateUrl: './context-menu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContextMenuComponent {
  readonly menu = inject(ContextMenuService);

  onAction(item: ContextMenuActionItem, event: MouseEvent): void {
    event.stopPropagation();
    if (item.disabled) return;
    item.action();
    this.menu.hide();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.menu.hide();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menu.hide();
  }
}
