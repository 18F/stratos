import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs/Observable';
import { filter, first, map, publishReplay, refCount } from 'rxjs/operators';

import { IOrganization, ISpace } from '../../core/cf-api.types';
import {
  isOrgAuditor,
  isOrgBillingManager,
  isOrgManager,
  isOrgUser,
  isSpaceAuditor,
  isSpaceDeveloper,
  isSpaceManager,
} from '../../features/cloud-foundry/cf.helpers';
import { GetAllUsers, GetUser } from '../../store/actions/users.actions';
import { AppState } from '../../store/app-state';
import { cfUserSchemaKey, endpointSchemaKey, entityFactory } from '../../store/helpers/entity-factory';
import { createEntityRelationPaginationKey } from '../../store/helpers/entity-relations.types';
import {
  getPaginationObservables,
  PaginationObservables,
} from '../../store/reducers/pagination-reducer/pagination-reducer.helper';
import { APIResource } from '../../store/types/api.types';
import {
  CfUser,
  createUserRoleInOrg,
  createUserRoleInSpace,
  IUserPermissionInOrg,
  IUserPermissionInSpace,
  UserRoleInOrg,
  UserRoleInSpace,
} from '../../store/types/user.types';
import { PaginationMonitorFactory } from '../monitors/pagination-monitor.factory';
import { ActiveRouteCfOrgSpace } from './../../features/cloud-foundry/cf-page.types';
import { EntityServiceFactory } from '../../core/entity-service-factory.service';

@Injectable()
export class CfUserService {
  public allUsersAction: GetAllUsers;
  private allUsers$: PaginationObservables<APIResource<CfUser>>;

  constructor(
    private store: Store<AppState>,
    public paginationMonitorFactory: PaginationMonitorFactory,
    public activeRouteCfOrgSpace: ActiveRouteCfOrgSpace,
    private entityServiceFactory: EntityServiceFactory,
  ) {
  }

  getUsers = (endpointGuid: string): Observable<APIResource<CfUser>[]> =>
    this.getAllUsers(endpointGuid).entities$.pipe(
      publishReplay(1),
      refCount(),
      filter(p => {
        return !!p;
      }),
      map(users => {
        console.log(users);
        return users.filter(p => p.entity.cfGuid === endpointGuid);
      }),
      filter(p => {
        return p.length > 0;
      }),
    )

  getUser = (endpointGuid: string, userGuid: string): Observable<APIResource<CfUser>> => {
    return this.entityServiceFactory.create<APIResource<CfUser>>(
      cfUserSchemaKey,
      entityFactory(cfUserSchemaKey),
      userGuid,
      new GetUser(endpointGuid, userGuid),
      true
    ).entityObs$.pipe(
      filter(entity => !!entity),
      map(entity => entity.entity)
    );
  }

  getOrgRolesFromUser(user: CfUser): IUserPermissionInOrg[] {
    const role = user['organizations'] as APIResource<IOrganization>[];
    return role.map(org => {
      const orgGuid = org.metadata.guid;
      return {
        name: org.entity.name as string,
        orgGuid: org.metadata.guid,
        permissions: createUserRoleInOrg(
          isOrgManager(user, orgGuid),
          isOrgBillingManager(user, orgGuid),
          isOrgAuditor(user, orgGuid),
          isOrgUser(user, orgGuid)
        )
      };
    });
  }

  getSpaceRolesFromUser(user: CfUser): IUserPermissionInSpace[] {
    const role = user['spaces'] as APIResource<ISpace>[];
    return role.map(space => {
      const spaceGuid = space.metadata.guid;
      return {
        name: space.entity.name as string,
        orgGuid: space.entity.organization_guid,
        spaceGuid: spaceGuid,
        permissions: createUserRoleInSpace(
          isSpaceManager(user, spaceGuid),
          isSpaceAuditor(user, spaceGuid),
          isSpaceDeveloper(user, spaceGuid)
        )
      };
    });
  }

  getUserRoleInOrg = (
    userGuid: string,
    orgGuid: string,
    cfGuid: string
  ): Observable<UserRoleInOrg> => {
    return this.getUsers(cfGuid).pipe(
      this.getUserFromUsers(userGuid),
      map(user => {
        return createUserRoleInOrg(
          isOrgManager(user.entity, orgGuid),
          isOrgBillingManager(user.entity, orgGuid),
          isOrgAuditor(user.entity, orgGuid),
          isOrgUser(user.entity, orgGuid)
        );
      }),
      first()
    );
  }

  getUserRoleInSpace = (
    userGuid: string,
    spaceGuid: string,
    cfGuid: string
  ): Observable<UserRoleInSpace> => {
    return this.getUsers(cfGuid).pipe(
      this.getUserFromUsers(userGuid),
      map(user => {
        return createUserRoleInSpace(
          isSpaceManager(user.entity, spaceGuid),
          isSpaceAuditor(user.entity, spaceGuid),
          isSpaceDeveloper(user.entity, spaceGuid)
        );
      })
    );
  }

  public createPaginationAction(endpointGuid: string): GetAllUsers {
    // See issue #1741 - Will not work for non-admins
    return new GetAllUsers(
      createEntityRelationPaginationKey(endpointSchemaKey, endpointGuid),
      endpointGuid
    );
  }

  private getAllUsers(endpointGuid: string): PaginationObservables<APIResource<CfUser>> {
    const allUsersAction = this.createPaginationAction(endpointGuid);
    if (!this.allUsers$) {
      this.allUsers$ = getPaginationObservables<APIResource<CfUser>>({
        store: this.store,
        action: allUsersAction,
        paginationMonitor: this.paginationMonitorFactory.create(
          allUsersAction.paginationKey,
          entityFactory(cfUserSchemaKey)
        )
      });
    }
    return this.allUsers$;
  }

  private getUserFromUsers(userGuid: string): (source: Observable<APIResource<CfUser>[]>) => Observable<APIResource<CfUser>> {
    return map(users => {
      return users.filter(o => o.metadata.guid === userGuid)[0];
    });
  }
}
