import { DatePipe } from '@angular/common';
import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { CfCellHealthDataSource, CfCellHealthEntry, CfCellHealthState } from './cf-cell-health-source';
import { BaseCfListConfig } from '../base-cf/base-cf-list-config';
import { ListView } from '../../../../../../../store/src/actions/list.actions';
import { ListViewTypes } from '../../list.component.types';
import {
  TableCellBooleanIndicatorComponentConfig,
  TableCellBooleanIndicatorComponent
} from '../../list-table/table-cell-boolean-indicator/table-cell-boolean-indicator.component';
import { BooleanIndicatorType } from '../../../boolean-indicator/boolean-indicator.component';
import { CFAppState } from '../../../../../../../cloud-foundry/src/cf-app-state';
import {
  CloudFoundryCellService
} from '../../../../../features/cloud-foundry/tabs/cloud-foundry-cells/cloud-foundry-cell/cloud-foundry-cell.service';
import { FetchCFCellMetricsPaginatedAction, MetricQueryConfig } from '../../../../../../../store/src/actions/metrics.actions';
import { MetricQueryType } from '../../../../services/metrics-range-selector.types';
import { ITableColumn } from '../../list-table/table.types';

@Injectable()
export class CfCellHealthListConfigService extends BaseCfListConfig<CfCellHealthEntry> {

  dataSource: CfCellHealthDataSource;
  defaultView = 'table' as ListView;
  viewType = ListViewTypes.TABLE_ONLY;
  enableTextFilter = false;
  text = {
    title: 'Cell Health History',
    noEntries: 'Cell has no health history'
  };

  private boolIndicatorConfig: TableCellBooleanIndicatorComponentConfig<CfCellHealthEntry> = {
    isEnabled: (row: CfCellHealthEntry) =>
      row ? row.state === CfCellHealthState.HEALTHY || row.state === CfCellHealthState.INITIAL_HEALTHY : false,
    type: BooleanIndicatorType.healthyUnhealthy,
    subtle: false,
    showText: true
  };

  constructor(store: Store<CFAppState>, cloudFoundryCellService: CloudFoundryCellService, private datePipe: DatePipe) {
    super();
    const action = this.createMetricsAction(cloudFoundryCellService.cfGuid, cloudFoundryCellService.cellId);
    this.dataSource = new CfCellHealthDataSource(store, this, action);
    this.showMetricsRange = true;
  }

  private createMetricsAction(cfGuid: string, cellId: string): FetchCFCellMetricsPaginatedAction {
    const action = new FetchCFCellMetricsPaginatedAction(
      cfGuid,
      cellId,
      new MetricQueryConfig(`firehose_value_metric_rep_unhealthy_cell{bosh_job_id="${cellId}"}`, {}),
      MetricQueryType.QUERY
    );
    action.initialParams['order-direction-field'] = 'dateTime';
    action.initialParams['order-direction'] = 'asc';
    return action;
  }

  getColumns = (): ITableColumn<CfCellHealthEntry>[] => [
    {
      columnId: 'dateTime',
      headerCell: () => 'Date/Time',
      cellFlex: '1',
      cellDefinition: {
        getValue: (entry: CfCellHealthEntry) => this.datePipe.transform(entry.timestamp * 1000, 'medium')
      },
      sort: {
        type: 'sort',
        orderKey: 'dateTime',
        field: 'timestamp'
      }
    },
    {
      columnId: 'state',
      headerCell: () => 'Cell Health Updated',
      cellComponent: TableCellBooleanIndicatorComponent,
      cellConfig: this.boolIndicatorConfig,
      cellFlex: '1',
      sort: {
        type: 'sort',
        orderKey: 'state',
        field: 'state'
      }
    },
  ]
  getDataSource = () => this.dataSource;
}
