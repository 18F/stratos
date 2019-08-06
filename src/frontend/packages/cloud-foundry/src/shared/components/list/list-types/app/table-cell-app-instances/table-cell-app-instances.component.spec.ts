import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CoreModule } from '../../../../../../../../core/src/core/core.module';
import {
  RunningInstancesComponent,
} from '../../../../../../../../core/src/shared/components/running-instances/running-instances.component';
import { PaginationMonitorFactory } from '../../../../../../../../core/src/shared/monitors/pagination-monitor.factory';
import { generateCfStoreModules } from '../../../../../../../../core/test-framework/cloud-foundry-endpoint-service.helper';
import { TableCellAppInstancesComponent } from './table-cell-app-instances.component';

describe('TableCellAppInstancesComponent', () => {
  let component: TableCellAppInstancesComponent<any>;
  let fixture: ComponentFixture<TableCellAppInstancesComponent<any>>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [
        TableCellAppInstancesComponent,
        RunningInstancesComponent
      ],
      imports: [
        CoreModule,
        generateCfStoreModules(),
      ],
      providers: [
        PaginationMonitorFactory
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TableCellAppInstancesComponent);
    component = fixture.componentInstance;
    component.row = { entity: {}, metadata: {} };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
