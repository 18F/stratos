import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { CoreModule } from '../../../core/core.module';
import { ActiveRouteCfOrgSpace } from '../../../features/cloud-foundry/cf-page.types';
import { CfRolesService } from '../../../features/cloud-foundry/users/manage-users/cf-roles.service';
import { createBasicStoreModule } from '../../../test-framework/store-test-helper';
import { CfUserService } from '../../data-services/cf-user.service';
import { PaginationMonitorFactory } from '../../monitors/pagination-monitor.factory';
import { CfRoleCheckboxComponent } from './cf-role-checkbox.component';


describe('CfRoleCheckboxComponent', () => {
  let component: CfRoleCheckboxComponent;
  let fixture: ComponentFixture<CfRoleCheckboxComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        CoreModule,
        // SharedModule,
        createBasicStoreModule(),
        NoopAnimationsModule
      ],
      providers: [
        CfUserService,
        CfRolesService,
        PaginationMonitorFactory,
        ActiveRouteCfOrgSpace
      ],
      declarations: [CfRoleCheckboxComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CfRoleCheckboxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
