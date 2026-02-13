import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { LoaderService } from './core/services/loader.service';

/**
 * LoaderComponent — full-screen loading overlay with animated bars.
 *
 * Displays a pulsing "equalizer" animation (Wigma-branded) and a status
 * message. Covers everything with an opaque backdrop and blocks
 * interaction while visible.
 */
@Component({
  selector: 'app-loader',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loader.loading()) {
      <div class="loader-backdrop">
        <div class="loader-content">
          <!-- Animated bars -->
          <div class="loader-bars">
            <span class="bar bar-1"></span>
            <span class="bar bar-2"></span>
            <span class="bar bar-3"></span>
            <span class="bar bar-4"></span>
            <span class="bar bar-5"></span>
          </div>
          <p class="loader-message">{{ loader.message() }}</p>
        </div>
      </div>
    }
  `,
  styles: [`
    .loader-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #09090b;
      contain: layout paint style;
      animation: backdrop-in 0.25s ease-out;
    }

    .loader-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }

    /* ── Animated bars (equalizer style) ────────────────── */
    .loader-bars {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      height: 40px;
    }

    .bar {
      width: 5px;
      border-radius: 2px;
      background: linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%);
      animation: bar-pulse 1s ease-in-out infinite;
    }

    .bar-1 { height: 12px; animation-delay: 0s; }
    .bar-2 { height: 20px; animation-delay: 0.12s; }
    .bar-3 { height: 32px; animation-delay: 0.24s; }
    .bar-4 { height: 20px; animation-delay: 0.36s; }
    .bar-5 { height: 12px; animation-delay: 0.48s; }

    @keyframes bar-pulse {
      0%, 100% { transform: scaleY(0.4); opacity: 0.5; }
      50%      { transform: scaleY(1);   opacity: 1; }
    }

    /* ── Message ──────────────────────────────────────────── */
    .loader-message {
      margin: 0;
      font-size: 13px;
      font-weight: 500;
      color: #a1a1aa;
      letter-spacing: 0.03em;
      font-family: 'Inter', system-ui, sans-serif;
    }

    /* ── Backdrop entrance ────────────────────────────────── */
    @keyframes backdrop-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
  `]
})
export class LoaderComponent {
  readonly loader = inject(LoaderService);
}
