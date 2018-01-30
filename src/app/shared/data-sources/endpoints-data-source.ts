import { interval } from 'rxjs/observable/interval';
import { TableRowStateManager } from './../components/table/table-row/table-row-state-manager';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs/Rx';

import { EndpointSchema, GetAllCNSIS } from '../../store/actions/cnsis.actions';
import { SetListStateAction } from '../../store/actions/list.actions';
import { AppState } from '../../store/app-state';
import { cnsisEntitiesSelector, cnsisStatusSelector } from '../../store/selectors/cnsis.selectors';
import { CNSISModel } from '../../store/types/cnsis.types';
import { ListDataSource } from './list-data-source';
import { map } from 'rxjs/operators';


export class EndpointsDataSource extends ListDataSource<CNSISModel> {

  isLoadingPage$: Observable<boolean>;
  data$: any;
  store: Store<AppState>;

  constructor(
    store: Store<AppState>,
  ) {
    const action = new GetAllCNSIS();
    const paginationKey = GetAllCNSIS.storeKey;
    const rowStateManager = new TableRowStateManager({
      '2fa75a76-c2e6-490f-acac-02eabb1bbf6a': {
        error: true,
        message: '<a href="#">Lorem ipsum dolor</a> sit amet, consectetur adipiscing elit. Nulla malesuada ullamcorper massa eu euismod.',
        blocked: false
      },
      '6dd897cb-2e93-422d-b707-15ce24e76bdb': {
        error: false,
        message: 'Me too',
        blocked: true
      }
    });
    interval(5000).pipe(
      map(() => {
        rowStateManager.updateRowState('2fa75a76-c2e6-490f-acac-02eabb1bbf6a', {
          error: false
        });
        rowStateManager.updateRowState('6dd897cb-2e93-422d-b707-15ce24e76bdb', {
          error: true
        });
      })
    ).subscribe();
    super({
      store,
      action,
      schema: EndpointSchema,
      getRowUniqueId: object => object.guid,
      getEmptyType: () => ({
        name: ''
      }),
      paginationKey,
      isLocal: true,
      entityFunctions: [
        {
          type: 'filter',
          field: 'name'
        },
        {
          type: 'sort',
          orderKey: 'name',
          field: 'name'
        },
        {
          type: 'sort',
          orderKey: 'connection',
          field: 'info.user'
        },
        {
          type: 'sort',
          orderKey: 'type',
          field: 'cnsi_type'
        },
        {
          type: 'sort',
          orderKey: 'address',
          field: 'api_endpoint.Host'
        },
      ],
      rowsState: rowStateManager.observable
    });
    this.store = store;
    store.dispatch(new SetListStateAction(
      paginationKey,
      'table',
    ));

  }

  connect(): Observable<CNSISModel[]> {
    this.isLoadingPage$ = this.isLoadingPage$ || this.store.select(cnsisStatusSelector).map((cnsis => cnsis.loading));
    this.data$ = this.data$ || this.store.select(cnsisEntitiesSelector)
      .map(cnsis => Object.values(cnsis));
    return super.connect();
  }
}
