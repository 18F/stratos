import { Store } from '@ngrx/store';

import { GetServicePlansForService } from '../../../../../../../cloud-foundry/src/actions/service.actions';
import { CFAppState } from '../../../../../../../cloud-foundry/src/cf-app-state';
import {
  cfEntityFactory,
  serviceEntityType,
  serviceInstancesEntityType,
  servicePlanEntityType,
} from '../../../../../../../cloud-foundry/src/cf-entity-factory';
import { getRowMetadata } from '../../../../../../../cloud-foundry/src/features/cloud-foundry/cf.helpers';
import {
  populateServicePlanExtraTyped,
} from '../../../../../../../cloud-foundry/src/features/service-catalog/services-helper';
import { IServicePlan } from '../../../../../../../core/src/core/cf-api-svc.types';
import {
  ListDataSource,
} from '../../../../../../../core/src/shared/components/list/data-sources-controllers/list-data-source';
import { IListConfig } from '../../../../../../../core/src/shared/components/list/list.component.types';
import {
  createEntityRelationKey,
  createEntityRelationPaginationKey,
} from '../../../../../../../store/src/helpers/entity-relations/entity-relations.types';
import { APIResource } from '../../../../../../../store/src/types/api.types';

export class ServicePlansDataSource extends ListDataSource<APIResource<IServicePlan>> {
  constructor(
    cfGuid: string,
    serviceGuid: string,
    store: Store<CFAppState>,
    listConfig: IListConfig<APIResource>
  ) {

    const paginationKey = createEntityRelationPaginationKey(serviceInstancesEntityType, serviceGuid);
    const action = new GetServicePlansForService(serviceGuid, cfGuid, paginationKey, [
      createEntityRelationKey(servicePlanEntityType, serviceEntityType),
    ]);

    super({
      store,
      action,
      schema: cfEntityFactory(servicePlanEntityType),
      getRowUniqueId: getRowMetadata,
      paginationKey,
      isLocal: true,
      transformEntities: [
        (entities: APIResource<IServicePlan>[]) => {
          return entities.map(e => populateServicePlanExtraTyped(e));
        },
        { type: 'filter', field: 'entity.name' }
      ],
      listConfig
    });
  }
}
