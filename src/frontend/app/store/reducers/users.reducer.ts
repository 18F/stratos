import { Action } from '@ngrx/store';

import { OrgUserRoleNames, SpaceUserRoleNames } from '../../features/cloud-foundry/cf.helpers';
import { ADD_PERMISSION_SUCCESS, ChangeUserPermission, REMOVE_PERMISSION_SUCCESS } from '../actions/users.actions';
import { IRequestEntityTypeState } from '../app-state';
import { APIResource } from '../types/api.types';
import { APISuccessOrFailedAction } from '../types/request.types';
import { CfUser } from '../types/user.types';
import { IOrganization, ISpace } from '../../core/cf-api.types';

// export interface CfUserState {
//   [userGuid: string]: APIResource<CfUser>;
// }

const properties = {
  org: {
    [OrgUserRoleNames.MANAGER]: 'managed_organizations',
    [OrgUserRoleNames.BILLING_MANAGERS]: 'billing_managed_organizations',
    [OrgUserRoleNames.AUDITOR]: 'audited_organizations',
    [OrgUserRoleNames.USER]: 'organizations',
  },
  space: {
    [SpaceUserRoleNames.MANAGER]: 'managed_spaces',
    [SpaceUserRoleNames.AUDITOR]: 'audited_spaces',
    [SpaceUserRoleNames.DEVELOPER]: 'spaces'
  }
};


export function userReducer(state: IRequestEntityTypeState<APIResource<CfUser>>, action: APISuccessOrFailedAction) {
  const permAction = action.apiAction as ChangeUserPermission;
  switch (action.type) {
    case ADD_PERMISSION_SUCCESS:
    case REMOVE_PERMISSION_SUCCESS:
      const { entityGuid, isSpace, permissionTypeKey, userGuid } = permAction;
      return {
        ...state,
        [userGuid]: {
          ...state[userGuid],
          entity: updatePermission(state[userGuid].entity, entityGuid, isSpace, permissionTypeKey, action.type === ADD_PERMISSION_SUCCESS),
        }
      };
  }


  // if (action.type !== ADD_PERMISSION_SUCCESS && action.type !== REMOVE_PERMISSION_SUCCESS) {
  //   return state;
  // }
  // const successAction = action as APISuccessOrFailedAction;
  // const changeUserPermissionAction = successAction.apiAction as ChangeUserPermission;
  // const { entityGuid, isSpace, permissionTypeKey, userGuid } = changeUserPermissionAction;
  // return {
  //   ...state,
  //   [userGuid]: {
  //     ...state[userGuid],
  //     entity: updatePermission(state[userGuid].entity, entityGuid, isSpace, permissionTypeKey, action.type === ADD_PERMISSION_SUCCESS),
  //   }
  // };
}

function updatePermission(
  user: CfUser,
  entityGuid: string,
  isSpace: boolean,
  permissionType: OrgUserRoleNames | SpaceUserRoleNames,
  add = false) {
  const type = isSpace ? 'space' : 'org';
  const paramName = properties[type][permissionType];
  const newCollection = add ?
    [...user[paramName], entityGuid] :
    user[paramName].filter(guid => guid !== entityGuid);
  return {
    ...user,
    [paramName]: newCollection
  };
}

type StateEntity = ISpace | IOrganization;
interface StateEntities<T> { [guid: string]: APIResource<StateEntity>; }

export function userSpaceOrgReducer<T extends StateEntity>(isSpace: boolean) {
  return function (state: StateEntities<T>, action: APISuccessOrFailedAction) {
    const permAction = action.apiAction as ChangeUserPermission;
    switch (action.type) {
      case ADD_PERMISSION_SUCCESS:
      case REMOVE_PERMISSION_SUCCESS:
        const isAdd = action.type === ADD_PERMISSION_SUCCESS ? true : false;
        return (isSpace && !!permAction.isSpace) || (!isSpace && !permAction.isSpace) ? newEntityState<T>(state, permAction, isAdd) : state;
    }
    return state;
  };
}

function newEntityState<T extends StateEntity>(state: StateEntities<T>, action: ChangeUserPermission, add: boolean): StateEntities<T> {
  const apiResource: APIResource<StateEntity> = state[action.guid];
  if (!apiResource) {
    return state;
  }
  let roles: string[] = apiResource.entity[action.permissionTypeKey];
  if (!roles) {
    return state;
  }
  const index = roles.findIndex(guid => guid === action.userGuid);
  if (add) {
    // Add the user to the role... but only if it doesn't exist already
    if (index >= 0) {
      return state;
    }
    roles = [
      ...roles,
      action.userGuid
    ];
  } else {
    // Remove the user from the role... but only if it exists already
    if (index >= 0) {
      roles = [...roles];
      roles.splice(index, 1);
    }
  }
  return {
    ...state,
    [action.guid]: {
      ...apiResource,
      entity: Object.assign({}, apiResource.entity, {
        [action.permissionTypeKey]: roles
      })
    }
  };
}
