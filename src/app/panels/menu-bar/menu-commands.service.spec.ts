import { TestBed } from '@angular/core/testing';

import { MenuCommandsService } from './menu-commands.service';

describe('MenuCommandsService', () => {
  let service: MenuCommandsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MenuCommandsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
