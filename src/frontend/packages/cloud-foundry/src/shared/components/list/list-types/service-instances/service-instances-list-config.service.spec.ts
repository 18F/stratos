import { DatePipe } from '@angular/common';
import { inject, TestBed } from '@angular/core/testing';

import {
  BaseTestModules,
  generateCfStoreModules,
} from '../../../../../../../core/test-framework/cloud-foundry-endpoint-service.helper';
import { ServicesService } from '../../../../../features/service-catalog/services.service';
import { ServicesServiceMock } from '../../../../../features/service-catalog/services.service.mock';
import { ServiceInstancesListConfigService } from './service-instances-list-config.service';

describe('ServiceInstancesListConfigService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ServiceInstancesListConfigService,
        { provide: ServicesService, useClass: ServicesServiceMock },
        DatePipe],
      imports: [
        BaseTestModules,
        generateCfStoreModules(),
      ]
    });
  });

  it('should be created', inject([ServiceInstancesListConfigService], (service: ServiceInstancesListConfigService) => {
    expect(service).toBeTruthy();
  }));
});
