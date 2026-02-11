import { ChangeDetectionStrategy, Component, signal, HostListener } from '@angular/core';

export interface ContextMenuItem {
  label: string;
  shortcut?: string;
  separator?: boolean;
  action: () => void;
}

@Component({
  selector: 'app-context-menu',
  imports: [],
  templateUrl: './context-menu.component.html',
  styleUrl: './context-menu.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContextMenuComponent {
  readonly visible = signal(false);
  readonly position = signal({ x: 0, y: 0 });
  readonly items = signal<ContextMenuItem[]>([]);

  show(x: number, y: number, items: ContextMenuItem[]): void {
    this.position.set({ x, y });
    this.items.set(items);
    this.visible.set(true);
  }

  hide(): void {
    this.visible.set(false);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.hide();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.hide();
  }
}
