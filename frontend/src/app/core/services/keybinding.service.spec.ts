import { TestBed } from '@angular/core/testing';

import { KeybindingService } from './keybinding.service';

describe('KeybindingService', () => {
  let service: KeybindingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(KeybindingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
