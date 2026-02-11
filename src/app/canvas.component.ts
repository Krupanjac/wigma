import {
  ChangeDetectionStrategy,
  Component,
  Input,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  NgZone,
  inject,
} from '@angular/core';
import { CanvasEngine } from './engine/canvas-engine';

/**
 * CanvasComponent — hosts the PixiJS rendering surface.
 *
 * Initializes the engine inside NgZone.runOutsideAngular()
 * and handles container resize via ResizeObserver.
 */
@Component({
  selector: 'app-canvas',
  imports: [],
  templateUrl: './canvas.component.html',
  styleUrl: './canvas.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  private ngZone = inject(NgZone);
  private resizeObserver: ResizeObserver | null = null;

  @Input() engine: CanvasEngine | null = null;
  @ViewChild('canvasContainer', { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  ngAfterViewInit(): void {
    if (!this.engine) return;

    const container = this.containerRef.nativeElement;

    this.ngZone.runOutsideAngular(async () => {
      await this.engine!.init(container);

      // Watch for resize
      this.resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          this.engine!.resize(width, height);
        }
      });
      this.resizeObserver.observe(container);
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }
}
