import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FillSectionComponent } from './fill-section.component';

describe('FillSectionComponent', () => {
  let component: FillSectionComponent;
  let fixture: ComponentFixture<FillSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FillSectionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FillSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
