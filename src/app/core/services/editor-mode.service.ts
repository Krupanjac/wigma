import { Injectable, signal } from '@angular/core';

export type EditorMode = 'draw' | 'design' | 'dev';

@Injectable({
  providedIn: 'root'
})
export class EditorModeService {
  readonly mode = signal<EditorMode>('design');

  setMode(mode: EditorMode): void {
    this.mode.set(mode);
  }
}
