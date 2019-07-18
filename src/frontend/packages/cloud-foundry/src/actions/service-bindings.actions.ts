import { RequestOptions, URLSearchParams } from '@angular/http';

import { getActions } from '../../../store/src/actions/action.helper';
import { PaginatedAction, PaginationParam } from '../../../store/src/types/pagination.types';
import { ICFAction } from '../../../store/src/types/request.types';
import { cfEntityFactory, serviceBindingEntityType } from '../cf-entity-factory';
import { CFStartAction } from './cf-action.types';

export const DELETE_SERVICE_BINDING_ACTION = '[ Service Instances ] Delete Service Binding';
export const DELETE_SERVICE_BINDING_ACTION_SUCCESS = '[ Service Instances ] Delete Service Binding success';
export const DELETE_SERVICE_BINDING_ACTION_FAILURE = '[ Service Instances ] Delete Service Binding failure';

export const CREATE_SERVICE_BINDING_ACTION = '[ Service Instances ] Create Service Binding';
export const CREATE_SERVICE_BINDING_ACTION_SUCCESS = '[ Service Instances ] Create Service Binding success';
export const CREATE_SERVICE_BINDING_ACTION_FAILURE = '[ Service Instances ] Create Service Binding failure';

export class CreateServiceBinding extends CFStartAction implements ICFAction {
  constructor(
    public endpointGuid: string,
    public guid: string,
    public appGuid: string,
    public serviceInstanceGuid: string,
    public params: object,
  ) {
    super();
    this.options = new RequestOptions();
    this.options.url = `service_bindings`;
    this.options.method = 'post';
    this.options.body = {
      app_guid: appGuid,
      service_instance_guid: serviceInstanceGuid,
      parameters: params ? params : null,
    };
  }
  actions = [
    CREATE_SERVICE_BINDING_ACTION,
    CREATE_SERVICE_BINDING_ACTION_SUCCESS,
    CREATE_SERVICE_BINDING_ACTION_FAILURE
  ];
  entity = [cfEntityFactory(serviceBindingEntityType)];
  public endpointType = 'cf';
  entityType = serviceBindingEntityType;
  options: RequestOptions;
}

export class DeleteServiceBinding extends CFStartAction implements ICFAction {
  constructor(public endpointGuid: string, public guid: string, public serviceInstanceGuid: string) {
    super();
    this.options = new RequestOptions();
    this.options.url = `service_bindings/${guid}`;
    this.options.method = 'delete';
    this.options.params = new URLSearchParams();
    this.options.params.set('async', 'false');
    // Note: serviceInstanceGuid is used by the reducer to update the relevant serviceInstanceGuid, its not required for the action itself.
  }
  actions = [
    DELETE_SERVICE_BINDING_ACTION,
    DELETE_SERVICE_BINDING_ACTION_SUCCESS,
    DELETE_SERVICE_BINDING_ACTION_FAILURE
  ];
  entity = [cfEntityFactory(serviceBindingEntityType)];
  entityType = serviceBindingEntityType;
  options: RequestOptions;
  removeEntityOnDelete = true;
}

export class FetchAllServiceBindings extends CFStartAction implements PaginatedAction {
  constructor(public endpointGuid: string, public paginationKey: string, public includeRelations = [], public populateMissing = false) {
    super();
    this.options = new RequestOptions();
    this.options.url = 'service_bindings';
    this.options.method = 'get';
  }
  actions = getActions('Service Bindings', 'Get All');
  entity = [cfEntityFactory(serviceBindingEntityType)];
  entityType = serviceBindingEntityType;
  options: RequestOptions;
  initialParams: PaginationParam = {
    'order-direction': 'asc',
    page: 1,
    'results-per-page': 100,
  };
}
