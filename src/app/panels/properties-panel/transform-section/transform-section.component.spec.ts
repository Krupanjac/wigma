import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransformSectionComponent } from './transform-section.component';

describe('TransformSectionComponent', () => {
  let component: TransformSectionComponent;
  let fixture: ComponentFixture<TransformSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransformSectionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TransformSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
