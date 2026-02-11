import { ChangeDetectionStrategy, Component, signal, computed } from '@angular/core';
import { TransformSectionComponent } from './transform-section/transform-section.component';
import { FillSectionComponent } from './fill-section/fill-section.component';
import { StrokeSectionComponent } from './stroke-section/stroke-section.component';
import { TextSectionComponent } from './text-section/text-section.component';

@Component({
  selector: 'app-properties-panel',
  imports: [
    TransformSectionComponent,
    FillSectionComponent,
    StrokeSectionComponent,
    TextSectionComponent,
  ],
  templateUrl: './properties-panel.component.html',
  styleUrl: './properties-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertiesPanelComponent {
  readonly selectedCount = signal(0);
  readonly hasText = signal(false);
}
