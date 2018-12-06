import { Component, OnDestroy, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { combineLatest as observableCombineLatest, Observable, of as observableOf, Subscription } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

import { IApp, IOrganization } from '../../../../../../core/cf-api.types';
import { getStartedAppInstanceCount } from '../../../../../../core/cf.helpers';
import { CurrentUserPermissions } from '../../../../../../core/current-user-permissions.config';
import { CurrentUserPermissionsService } from '../../../../../../core/current-user-permissions.service';
import { getOrgRolesString } from '../../../../../../features/cloud-foundry/cf.helpers';
import {
  CloudFoundryEndpointService,
} from '../../../../../../features/cloud-foundry/services/cloud-foundry-endpoint.service';
import {
  createOrganizationStateObs,
} from '../../../../../../features/cloud-foundry/services/cloud-foundry-organization-helper';
import { RouterNav } from '../../../../../../store/actions/router.actions';
import { AppState } from '../../../../../../store/app-state';
import { entityFactory, organizationSchemaKey } from '../../../../../../store/helpers/entity-factory';
import { APIResource } from '../../../../../../store/types/api.types';
import { EndpointUser } from '../../../../../../store/types/endpoint.types';
import { createUserRoleInOrg } from '../../../../../../store/types/user.types';
import { CfUserService } from '../../../../../data-services/cf-user.service';
import { EntityMonitorFactory } from '../../../../../monitors/entity-monitor.factory.service';
import { PaginationMonitorFactory } from '../../../../../monitors/pagination-monitor.factory';
import { ComponentEntityMonitorConfig } from '../../../../../shared.types';
import { CardStatus } from '../../../../cards/card-status/card-status.component';
import { ConfirmationDialogConfig } from '../../../../confirmation-dialog.config';
import { ConfirmationDialogService } from '../../../../confirmation-dialog.service';
import { MetaCardMenuItem } from '../../../list-cards/meta-card/meta-card-base/meta-card.component';
import { CardCell } from '../../../list.types';


@Component({
  selector: 'app-cf-org-card',
  templateUrl: './cf-org-card.component.html',
  styleUrls: ['./cf-org-card.component.scss']
})
export class CfOrgCardComponent extends CardCell<APIResource<IOrganization>> implements OnInit, OnDestroy {
  cardMenu: MetaCardMenuItem[];
  orgGuid: string;
  normalisedMemoryUsage: number;
  memoryLimit: number;
  instancesLimit: number;
  subscriptions: Subscription[] = [];
  memoryTotal: number;
  instancesCount: number;
  appCount$: Observable<number>;
  userRolesInOrg: string;
  currentUser$: Observable<EndpointUser>;
  public entityConfig: ComponentEntityMonitorConfig;
  public orgStatus$: Observable<CardStatus>;

  constructor(
    private cfUserService: CfUserService,
    public cfEndpointService: CloudFoundryEndpointService,
    private store: Store<AppState>,
    private currentUserPermissionsService: CurrentUserPermissionsService,
    private confirmDialog: ConfirmationDialogService,
    private paginationMonitorFactory: PaginationMonitorFactory,
    private emf: EntityMonitorFactory
  ) {
    super();

    this.cardMenu = [
      {
        label: 'Edit',
        action: this.edit,
        can: this.currentUserPermissionsService.can(CurrentUserPermissions.ORGANIZATION_EDIT, this.cfEndpointService.cfGuid)
      },
      {
        label: 'Delete',
        action: this.delete,
        can: this.currentUserPermissionsService.can(CurrentUserPermissions.ORGANIZATION_DELETE, this.cfEndpointService.cfGuid)
      }
    ];
  }

  ngOnInit() {
    const userRole$ = this.cfEndpointService.currentUser$.pipe(
      switchMap(u => {
        // This is null if the endpoint is disconnected. Probably related to https://github.com/cloudfoundry-incubator/stratos/issues/1727
        if (!u) {
          return observableOf(createUserRoleInOrg(false, false, false, false));
        }
        return this.cfUserService.getUserRoleInOrg(u.guid, this.row.metadata.guid, this.row.entity.cfGuid);
      }),
      map(u => getOrgRolesString(u)),
    );

    const allApps$: Observable<APIResource<IApp>[]> = this.cfEndpointService.hasAllApps$.pipe(
      switchMap(hasAll => hasAll ? this.cfEndpointService.getAppsInOrg(this.row) : observableOf(null))
    );

    this.appCount$ = allApps$.pipe(
      switchMap(allApps => allApps ? observableOf(allApps.length) : CloudFoundryEndpointService.fetchAppCount(
        this.store,
        this.paginationMonitorFactory,
        this.cfEndpointService.cfGuid,
        this.row.metadata.guid
      ))
    );

    const fetchData$ = observableCombineLatest(
      userRole$,
      allApps$
    ).pipe(
      tap(([role, apps]) => {
        this.setValues(role, apps);
      })
    );

    this.subscriptions.push(fetchData$.subscribe());
    this.orgGuid = this.row.metadata.guid;
    this.entityConfig = new ComponentEntityMonitorConfig(this.orgGuid, entityFactory(organizationSchemaKey));

    this.orgStatus$ = createOrganizationStateObs(this.orgGuid, this.cfEndpointService, this.emf);
  }

  setAppsDependentCounts = (apps: APIResource<IApp>[]) => {
    this.instancesCount = getStartedAppInstanceCount(apps);
  }

  setValues = (role: string, apps: APIResource<IApp>[]) => {
    this.userRolesInOrg = role;
    if (apps) {
      this.setAppsDependentCounts(apps);
      this.memoryTotal = this.cfEndpointService.getMetricFromApps(apps, 'memory');
      this.normalisedMemoryUsage = this.memoryTotal / this.memoryLimit * 100;
    }
    const quotaDefinition = this.row.entity.quota_definition || {
      entity: {
        memory_limit: -1,
        app_instance_limit: -1,
        instance_memory_limit: -1,
        name: 'None assigned',
        organization_guid: this.orgGuid,
        total_services: -1,
        total_routes: -1
      },
      metadata: null
    };
    this.instancesLimit = quotaDefinition.entity.app_instance_limit;
    this.memoryLimit = quotaDefinition.entity.memory_limit;
  }

  ngOnDestroy = () => this.
    subscriptions.forEach(p =>
      p.unsubscribe())


  edit = () => {
    this.store.dispatch(
      new RouterNav({
        path: ['cloud-foundry', this.cfEndpointService.cfGuid, 'organizations', this.orgGuid, 'edit-org']
      })
    );
  }

  delete = () => {
    const confirmation = new ConfirmationDialogConfig(
      'Delete Organization',
      {
        textToMatch: this.row.entity.name
      },
      'Delete',
      true,
    );
    this.confirmDialog.open(confirmation, () => {
      this.cfEndpointService.deleteOrg(
        this.row.metadata.guid,
        this.cfEndpointService.cfGuid
      );
    });
  }

  goToSummary = () => this.store.dispatch(new RouterNav({
    path: ['cloud-foundry', this.cfEndpointService.cfGuid, 'organizations', this.orgGuid]
  }))
}
