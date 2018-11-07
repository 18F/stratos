import { IListDataSource } from '../../data-sources-controllers/list-data-source-types';
import { IListConfig, ListViewTypes } from '../../list.component.types';
import { ListView } from '../../../../../../../store/src/actions/list.actions';


export class BaseCfListConfig<T> implements IListConfig<T> {
  getDataSource: () => IListDataSource<T>;
  isLocal = true;
  viewType = ListViewTypes.CARD_ONLY;
  defaultView = 'cards' as ListView;
  cardComponent;
  enableTextFilter = false;
  getColumns = () => [];
  getGlobalActions = () => [];
  getMultiActions = () => [];
  getSingleActions = () => [];
  getMultiFiltersConfigs = () => [];
}
