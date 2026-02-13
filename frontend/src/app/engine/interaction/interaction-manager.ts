import { Vec2 } from '@shared/math/vec2';
import { ViewportManager } from '../viewport/viewport-manager';

/**
 * Pointer event data passed to tools and interaction handlers.
 */
export interface PointerEventData {
  screenPosition: Vec2;
  worldPosition: Vec2;
  button: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

/**
 * InteractionManager bridges DOM pointer events to the engine.
 *
 * Pointer events on the PixiJS stage → convert screen→world via camera
 * → delegate to active tool.
 */
export class InteractionManager {
  private listeners: {
    pointerDown: Array<(e: PointerEventData) => void>;
    pointerMove: Array<(e: PointerEventData) => void>;
    pointerUp: Array<(e: PointerEventData) => void>;
    wheel: Array<(e: WheelEvent) => void>;
    keyDown: Array<(e: KeyboardEvent) => void>;
    keyUp: Array<(e: KeyboardEvent) => void>;
  } = {
    pointerDown: [],
    pointerMove: [],
    pointerUp: [],
    wheel: [],
    keyDown: [],
    keyUp: [],
  };

  private element: HTMLElement | null = null;
  private currentCursor = 'default';

  constructor(private viewport: ViewportManager) {}

  /** Attach to a canvas container element. */
  attach(element: HTMLElement): void {
    this.element = element;

    element.addEventListener('pointerdown', this.handlePointerDown);
    element.addEventListener('pointermove', this.handlePointerMove);
    element.addEventListener('pointerup', this.handlePointerUp);
    element.addEventListener('pointerleave', this.handlePointerUp);
    element.addEventListener('wheel', this.handleWheel, { passive: false });
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  /** Detach all event listeners. */
  detach(): void {
    if (!this.element) return;
    this.element.removeEventListener('pointerdown', this.handlePointerDown);
    this.element.removeEventListener('pointermove', this.handlePointerMove);
    this.element.removeEventListener('pointerup', this.handlePointerUp);
    this.element.removeEventListener('pointerleave', this.handlePointerUp);
    this.element.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.element.style.cursor = 'default';
    this.element = null;
    this.currentCursor = 'default';
  }

  setCursor(cursor: string): void {
    if (this.currentCursor === cursor) return;
    this.currentCursor = cursor;
    if (this.element) {
      this.element.style.cursor = cursor;
    }
  }

  // ── Listener registration ──

  onPointerDown(handler: (e: PointerEventData) => void): () => void {
    this.listeners.pointerDown.push(handler);
    return () => this.removeListener(this.listeners.pointerDown, handler);
  }

  onPointerMove(handler: (e: PointerEventData) => void): () => void {
    this.listeners.pointerMove.push(handler);
    return () => this.removeListener(this.listeners.pointerMove, handler);
  }

  onPointerUp(handler: (e: PointerEventData) => void): () => void {
    this.listeners.pointerUp.push(handler);
    return () => this.removeListener(this.listeners.pointerUp, handler);
  }

  onWheel(handler: (e: WheelEvent) => void): () => void {
    this.listeners.wheel.push(handler);
    return () => this.removeListener(this.listeners.wheel, handler);
  }

  onKeyDown(handler: (e: KeyboardEvent) => void): () => void {
    this.listeners.keyDown.push(handler);
    return () => this.removeListener(this.listeners.keyDown, handler);
  }

  onKeyUp(handler: (e: KeyboardEvent) => void): () => void {
    this.listeners.keyUp.push(handler);
    return () => this.removeListener(this.listeners.keyUp, handler);
  }

  // ── Event handlers ──

  private createPointerData(e: PointerEvent): PointerEventData {
    const rect = this.element!.getBoundingClientRect();
    const screenPos = new Vec2(e.clientX - rect.left, e.clientY - rect.top);
    const worldPos = this.viewport.camera.screenToWorld(screenPos);

    return {
      screenPosition: screenPos,
      worldPosition: worldPos,
      button: e.button,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
    };
  }

  private handlePointerDown = (e: PointerEvent): void => {
    const data = this.createPointerData(e);
    for (const handler of this.listeners.pointerDown) handler(data);
  };

  private handlePointerMove = (e: PointerEvent): void => {
    const data = this.createPointerData(e);
    for (const handler of this.listeners.pointerMove) handler(data);
  };

  private handlePointerUp = (e: PointerEvent): void => {
    const data = this.createPointerData(e);
    for (const handler of this.listeners.pointerUp) handler(data);
  };

  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault();
    for (const handler of this.listeners.wheel) handler(e);
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    for (const handler of this.listeners.keyDown) handler(e);
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    for (const handler of this.listeners.keyUp) handler(e);
  };

  private removeListener<T>(arr: T[], item: T): void {
    const idx = arr.indexOf(item);
    if (idx >= 0) arr.splice(idx, 1);
  }
}
