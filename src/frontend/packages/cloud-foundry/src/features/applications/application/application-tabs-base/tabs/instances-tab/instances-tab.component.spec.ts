import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';

import { CoreModule } from '../../../../../../../../core/src/core/core.module';
import {
  ApplicationStateService,
} from '../../../../../../../../core/src/shared/components/application-state/application-state.service';
import { SharedModule } from '../../../../../../../../core/src/shared/shared.module';
import { ApplicationServiceMock } from '../../../../../../../../core/test-framework/application-service-helper';
import { generateCfStoreModules } from '../../../../../../../../core/test-framework/cloud-foundry-endpoint-service.helper';
import { getInitialTestStoreState } from '../../../../../../../../core/test-framework/store-test-helper';
import { AppStoreModule } from '../../../../../../../../store/src/store.module';
import { CloudFoundryComponentsModule } from '../../../../../../shared/components/components.module';
import { ApplicationService } from '../../../../application.service';
import { ApplicationEnvVarsHelper } from '../build-tab/application-env-vars.service';
import { InstancesTabComponent } from './instances-tab.component';

describe('InstancesTabComponent', () => {
  let component: InstancesTabComponent;
  let fixture: ComponentFixture<InstancesTabComponent>;
  const initialState = getInitialTestStoreState();

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [InstancesTabComponent],
      imports: [
        ...generateCfStoreModules(initialState),
        CoreModule,
        SharedModule,
        RouterTestingModule,
        BrowserAnimationsModule, // TODO: RC Search and replace with NoopAnimationsModule
        CloudFoundryComponentsModule
      ],
      providers: [
        { provide: ApplicationService, useClass: ApplicationServiceMock },
        AppStoreModule,
        ApplicationStateService,
        ApplicationEnvVarsHelper
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(InstancesTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
