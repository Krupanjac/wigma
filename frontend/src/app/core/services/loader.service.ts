import { Injectable, signal, computed } from '@angular/core';

/**
 * LoaderService — manages global loading overlay state.
 *
 * Supports stacking: multiple concurrent operations can each push a loading
 * state, and the overlay stays visible until the last one completes.
 */
@Injectable({ providedIn: 'root' })
export class LoaderService {
  /** Stack of active loading messages. */
  private readonly _stack = signal<string[]>([]);

  /** Whether any loading operation is in progress. */
  readonly loading = computed(() => this._stack().length > 0);

  /** The most recent (top-of-stack) message to display. */
  readonly message = computed(() => {
    const s = this._stack();
    return s.length > 0 ? s[s.length - 1] : '';
  });

  /**
   * Begin a loading operation.
   * @returns A dispose function to call when the operation completes.
   */
  show(message: string = 'Loading…'): () => void {
    this._stack.update(s => [...s, message]);
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      this._stack.update(s => {
        const idx = s.lastIndexOf(message);
        if (idx === -1) return s;
        const copy = [...s];
        copy.splice(idx, 1);
        return copy;
      });
    };
  }

  /**
   * Convenience: wrap an async operation with loading state.
   */
  async wrap<T>(message: string, fn: () => Promise<T>): Promise<T> {
    const done = this.show(message);
    try {
      return await fn();
    } finally {
      done();
    }
  }
}
