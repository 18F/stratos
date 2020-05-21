import { Inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { combineLatest, Observable, of as observableOf, of } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

import { InternalAppState } from '../../../store/src/app-state';
import {
  BaseCurrentUserPermissionsChecker,
  IConfigGroup,
  IConfigGroups,
  ICurrentUserPermissionsChecker,
  StratosUserPermissionsChecker,
} from './current-user-permissions.checker';
import {
  CurrentUserPermissions,
  PermissionConfig,
  PermissionConfigLink,
  PermissionConfigType,
  PermissionTypes,
} from './current-user-permissions.config';

interface ICheckCombiner {
  checks: Observable<boolean>[];
  combineType?: '&&';
}

export const CUSTOM_USER_PERMISSION_CHECKERS = 'custom_user_perm_checkers'

@Injectable()
export class CurrentUserPermissionsService {
  // private checker: StratosUserPermissionsChecker;
  private allCheckers: ICurrentUserPermissionsChecker[];
  constructor(
    store: Store<InternalAppState>,
    @Inject(CUSTOM_USER_PERMISSION_CHECKERS) customCheckers: ICurrentUserPermissionsChecker[],
  ) {
    this.allCheckers = [
      new StratosUserPermissionsChecker(store),
      ...customCheckers
    ]
  }
  /**
   * @param action The action we're going to check the user's access to.
   * @param endpointGuid If endpointGuid is provided without a  orgOrSpaceGuid the checks will be done across all orgs and
   * spaces within the cf.
   * If no endpoint guid is provided we will do the check over all of the endpoint and all orgs/spaces.
   * @param orgOrSpaceGuid If this is the only param then it will be used as the id to for all permission checks.
   * @param spaceGuid If this is provided then the orgOrSpaceGuid will be used for org related permission checks and this will be
   *  used for space related permission checks.
   */
  public can(
    action: CurrentUserPermissions | PermissionConfigType,
    endpointGuid?: string,
    ...args: any[]
  ): Observable<boolean> {
    let actionConfig;
    if (typeof action === 'string') {
      let permConfigType = this.getPermissionConfig(action);
      if (!permConfigType) {
        // TODO: RC
      }
      actionConfig = this.getConfig(permConfigType);
    } else {
      actionConfig = this.getConfig(action)
    }
    const obs$ = this.getCanObservable(actionConfig, endpointGuid, ...args);
    return obs$ ? obs$.pipe(
      distinctUntilChanged(),
    ) : observableOf(false);
  }

  private getCanObservable(
    actionConfig: PermissionConfig[] | PermissionConfig,
    endpointGuid: string,
    ...args: any[]): Observable<boolean> {
    if (Array.isArray(actionConfig)) {
      return this.getComplexPermission(actionConfig, ...args);
    } else if (actionConfig) {
      return this.getSimplePermission(actionConfig, endpointGuid, ...args);
    } else if (endpointGuid) {
      return this.getFallbackPermission(endpointGuid);
    }
    return null;
  }

  private getSimplePermission(actionConfig: PermissionConfig, endpointGuid: string, ...args: any[]) {
    for (let i = 0; i < this.allCheckers.length; i++) {
      // TODO: RC Check keys some how for dupes
      const checker = this.allCheckers[i];
      const check$ = checker.getSimpleCheck(actionConfig, endpointGuid, ...args);
      if (check$) {
        return check$;
      }
    }
    // TODO: RC
    return of(false);
    // const check$ = this.checker.getSimpleCheck(actionConfig, endpointGuid, orgOrSpaceGuid, spaceGuid);
    // if (actionConfig.type === PermissionTypes.ORGANIZATION || actionConfig.type === PermissionTypes.SPACE) {
    //   return this.applyAdminCheck(check$, endpointGuid);
    // }
    // return check$;
  }

  private getComplexPermission(actionConfigs: PermissionConfig[], endpointGuid?: string, orgOrSpaceGuid?: string, spaceGuid?: string) {
    const groupedChecks = this.groupConfigs(actionConfigs);
    const checks = this.getChecksFromConfigGroups(groupedChecks, endpointGuid, orgOrSpaceGuid, spaceGuid);
    return this.combineChecks(checks);
  }

  // TODO: RC COMMON?
  private groupConfigs(configs: PermissionConfig[]): IConfigGroups {
    return configs.reduce((grouped, config) => {
      const type = config.type;
      return {
        ...grouped,
        [type]: [
          ...(grouped[type] || []),
          config
        ]
      };
    }, {});
  }


  private getChecksFromConfigGroups(groups: IConfigGroups, endpointGuid?: string, orgOrSpaceGuid?: string, spaceGuid?: string) {
    return Object.keys(groups).map((permission: PermissionTypes) => {
      return this.getCheckFromConfig(groups[permission], permission, endpointGuid, orgOrSpaceGuid, spaceGuid);
    });
  }

  private getCheckFromConfig(
    configGroup: IConfigGroup,
    permission: PermissionTypes,// | CHECKER_GROUPS,
    ...args: any[]
  ): ICheckCombiner {
    for (let i = 0; i < this.allCheckers.length; i++) {
      const checker = this.allCheckers[i];
      const check = checker.getCheckFromConfig(configGroup, permission, ...args);
      if (check) {
        return check;
      }
    }
    // TODO: RC
    return null;

    // switch (permission) {
    //   case PermissionTypes.ENDPOINT:
    //     return {
    //       checks: this.checker.getInternalScopesChecks(configGroup),
    //     };
    //   case PermissionTypes.ENDPOINT_SCOPE:
    //     return {
    //       checks: this.checker.getEndpointScopesChecks(configGroup, endpointGuid),
    //     };
    //   case PermissionTypes.STRATOS_SCOPE:
    //     return {
    //       checks: this.checker.getInternalScopesChecks(configGroup),
    //     };
    //   case PermissionTypes.FEATURE_FLAG:
    //     return {
    //       checks: this.checker.getFeatureFlagChecks(configGroup, endpointGuid),
    //       combineType: '&&'
    //     };
    //   case CHECKER_GROUPS.CF_GROUP: //PermissionTypes.ORGANIZATION || config.type === PermissionTypes.SPACE
    //     return {
    //       checks: this.checker.getCfChecks(configGroup, endpointGuid, orgOrSpaceGuid, spaceGuid)
    //     };
    // }
  }

  private getConfig(config: PermissionConfigType, tries = 0): PermissionConfig[] | PermissionConfig {
    const linkConfig = config as PermissionConfigLink;
    if (linkConfig.link) {
      if (tries >= 20) {
        // Tried too many times to get permission config, circular reference very likely.
        return;
      }
      ++tries;
      return this.getLinkedPermissionConfig(linkConfig, tries);
    } else {
      return config as PermissionConfig[] | PermissionConfig;
    }
  }

  private getLinkedPermissionConfig(linkConfig: PermissionConfigLink, tries = 0) {
    return this.getConfig(this.getPermissionConfig(linkConfig.link), tries);
  }

  private combineChecks(
    checkCombiners: ICheckCombiner[],
  ) {
    const reducedChecks = checkCombiners.map(combiner => BaseCurrentUserPermissionsChecker.reduceChecks(combiner.checks, combiner.combineType));
    return combineLatest(reducedChecks).pipe(
      map(checks => checks.every(check => check))
    );
  }

  private getFallbackPermission(endpointGuid: string) {
    for (let i = 0; i < this.allCheckers.length; i++) {
      const checker = this.allCheckers[i];
      const check = checker.getFallbackPermission(endpointGuid);
      if (check) {
        return check;
      }
    }

    // TODO: RC
    return null;
  }

  private getPermissionConfig(key: CurrentUserPermissions): PermissionConfigType {
    // TODO: RC this can leak between plugins
    let permConfigType;
    for (let i = 0; i < this.allCheckers.length; i++) {
      // TODO: RC Check keys some how for dupes
      const checker = this.allCheckers[i];
      permConfigType = checker.getPermissionConfig(key);
      if (permConfigType) {
        return permConfigType;
      }
    }
  }
}
