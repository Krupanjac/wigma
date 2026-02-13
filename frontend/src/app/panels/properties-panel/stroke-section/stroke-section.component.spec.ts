import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StrokeSectionComponent } from './stroke-section.component';

describe('StrokeSectionComponent', () => {
  let component: StrokeSectionComponent;
  let fixture: ComponentFixture<StrokeSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StrokeSectionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StrokeSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
