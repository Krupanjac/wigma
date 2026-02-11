import { Injectable, NgZone, inject, OnDestroy } from '@angular/core';

export interface Keybinding {
  /** e.g. 'ctrl+z', 'shift+a', 'delete', 'ctrl+shift+g' */
  combo: string;
  action: () => void;
  /** Prevent default browser behavior. Default true. */
  preventDefault?: boolean;
}

/**
 * KeybindingService — global keyboard shortcut manager.
 *
 * Listens on document level. Keybindings are registered and unregistered
 * dynamically. Modifier normalization handles Mac/Win differences.
 */
@Injectable({
  providedIn: 'root'
})
export class KeybindingService implements OnDestroy {
  private ngZone = inject(NgZone);
  private bindings = new Map<string, Keybinding>();
  private listener: ((e: KeyboardEvent) => void) | null = null;

  /** Start listening for keyboard events. Call once after bootstrap. */
  init(): void {
    this.listener = (e: KeyboardEvent) => {
      const combo = this.eventToCombo(e);
      const binding = this.bindings.get(combo);
      if (binding) {
        if (binding.preventDefault !== false) {
          e.preventDefault();
        }
        this.ngZone.run(() => binding.action());
      }
    };

    document.addEventListener('keydown', this.listener);
  }

  register(binding: Keybinding): () => void {
    const key = binding.combo.toLowerCase();
    this.bindings.set(key, binding);
    return () => this.bindings.delete(key);
  }

  registerMany(bindings: Keybinding[]): () => void {
    const unsubs = bindings.map(b => this.register(b));
    return () => unsubs.forEach(fn => fn());
  }

  unregisterAll(): void {
    this.bindings.clear();
  }

  ngOnDestroy(): void {
    if (this.listener) {
      document.removeEventListener('keydown', this.listener);
    }
    this.bindings.clear();
  }

  private eventToCombo(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');

    const key = e.key.toLowerCase();
    // Don't add modifier keys alone
    if (!['control', 'alt', 'shift', 'meta'].includes(key)) {
      parts.push(key);
    }

    return parts.join('+');
  }
}
