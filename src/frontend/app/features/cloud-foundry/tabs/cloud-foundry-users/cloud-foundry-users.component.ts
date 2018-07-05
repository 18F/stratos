import { CfUserListConfigService } from './../../../../shared/components/list/list-types/cf-users/cf-user-list-config.service';
import { ListConfig } from './../../../../shared/components/list/list.component.types';
import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { CfUserService } from '../../../../shared/data-services/cf-user.service';
import { Router } from '@angular/router';
import { ActiveRouteCfOrgSpace } from '../../cf-page.types';
import { CurrentUserPermissionsService } from '../../../../core/current-user-permissions.service';
import { AppState } from '../../../../store/app-state';
import { PaginationMonitorFactory } from '../../../../shared/monitors/pagination-monitor.factory';

@Component({
  selector: 'app-cloud-foundry-users',
  templateUrl: './cloud-foundry-users.component.html',
  styleUrls: ['./cloud-foundry-users.component.scss'],
  providers: [{
    provide: ListConfig,
    useFactory: (
      store: Store<AppState>,
      cfUserService: CfUserService,
      router: Router,
      activeRouteCfOrgSpace: ActiveRouteCfOrgSpace,
      userPerms: CurrentUserPermissionsService,
      paginationMonitorFactory: PaginationMonitorFactory
    ) => new CfUserListConfigService(store, cfUserService, router, activeRouteCfOrgSpace, userPerms, paginationMonitorFactory),
    deps: [Store, CfUserService, Router, ActiveRouteCfOrgSpace, CurrentUserPermissionsService]
  }]
})
export class CloudFoundryUsersComponent { }
