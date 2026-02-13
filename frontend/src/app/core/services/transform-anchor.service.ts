import { Injectable, signal } from '@angular/core';
import { TransformAnchor } from '../../shared/transform-anchor';

@Injectable({
  providedIn: 'root'
})
export class TransformAnchorService {
  readonly anchor = signal<TransformAnchor>('center');

  setAnchor(anchor: TransformAnchor): void {
    this.anchor.set(anchor);
  }
}
