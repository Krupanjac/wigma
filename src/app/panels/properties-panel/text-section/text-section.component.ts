import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CanvasEngine } from '../../../engine/canvas-engine';
import { BaseNode } from '../../../engine/scene-graph/base-node';

@Component({
  selector: 'app-text-section',
  imports: [],
  templateUrl: './text-section.component.html',
  styleUrl: './text-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TextSectionComponent {
  @Input() engine: CanvasEngine | null = null;
  @Input() node: BaseNode | null = null;
}
