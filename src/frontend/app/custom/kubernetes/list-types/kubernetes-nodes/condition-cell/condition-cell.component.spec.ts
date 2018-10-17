import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ConditionCellComponent } from './condition-cell.component';
import { BaseTestModules } from '../../../../../test-framework/cloud-foundry-endpoint-service.helper';

describe('ConditionCellComponent', () => {
  let component: ConditionCellComponent;
  let fixture: ComponentFixture<ConditionCellComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ConditionCellComponent],
      imports: BaseTestModules
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ConditionCellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
