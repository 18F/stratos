import { OrchestratedActionBuilders } from '../../../core/src/core/entity-catalogue/action-orchestrator/action-orchestrator';
import {
  GetOrganizationSpaceQuotaDefinitions,
  GetQuotaDefinitions,
  AssociateSpaceQuota,
  DisassociateSpaceQuota
} from '../actions/quota-definitions.actions';
import { CFBasePipelineRequestActionMeta } from '../cf-entity-generator';

export const quotaDefinitionActionBuilder = {
  getMultiple: (
    paginationKey: string,
    endpointGuid: string,
    { includeRelations, populateMissing }: CFBasePipelineRequestActionMeta = {}
  ) => new GetQuotaDefinitions(paginationKey, endpointGuid, includeRelations, populateMissing),
  associateSpaceQuota: (
    spaceGuid: string,
    endpointGuid: string,
    spaceQuotaGuid: string
  ) => new AssociateSpaceQuota(spaceGuid, endpointGuid, spaceQuotaGuid),
  disassociateSpaceQuota: (
    spaceGuid: string,
    endpointGuid: string,
    spaceQuotaGuid: string
  ) => new DisassociateSpaceQuota(spaceGuid, endpointGuid, spaceQuotaGuid),
  getOrganizationSpaceQuotaDefinitions: (
    orgGuid: string,
    paginationKey: string,
    endpointGuid: string,
    includeRelations: string[] = [],
    populateMissing = true
  ) => new GetOrganizationSpaceQuotaDefinitions(paginationKey, orgGuid, endpointGuid, includeRelations, populateMissing)
} as OrchestratedActionBuilders;


