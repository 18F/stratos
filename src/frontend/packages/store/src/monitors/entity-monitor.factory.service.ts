import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { AppState } from '../app-state';
import { entityCatalog } from '../entity-catalog/entity-catalog';
import { EntityCatalogHelper } from '../entity-catalog/entity-catalog.service';
import { EntityCatalogEntityConfig } from '../entity-catalog/entity-catalog.types';
import { EntityMonitor } from './entity-monitor';

@Injectable()
export class EntityMonitorFactory {

  constructor(
    private store: Store<AppState>,
    private ech: EntityCatalogHelper
  ) { }

  private monitorCache: {
    [key: string]: EntityMonitor
  } = {};

  public create<T>(
    id: string,
    entityConfig: EntityCatalogEntityConfig,
    startWithNull = true
  ): EntityMonitor<T> {
    const { endpointType, entityType } = entityConfig;
    const cacheKey = id + endpointType + entityType;
    if (this.monitorCache[cacheKey]) {
      return this.monitorCache[cacheKey];
    } else {
      const catalogEntity = entityCatalog.getEntity(entityConfig);
      if (!catalogEntity) {
        throw new Error(`Could not find catalog entity for endpoint type '${endpointType}' and entity type '${entityType}'`);
      }
      const monitor = catalogEntity.getEntityMonitor(
        this.ech,
        id,
        {
          startWithNull,
          schemaKey: entityConfig.schemaKey
        }
      );
      this.monitorCache[cacheKey] = monitor;
      return monitor;
    }
  }

}
