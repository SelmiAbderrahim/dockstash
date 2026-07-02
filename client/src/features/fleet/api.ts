import { apiClient } from '@shared/api/client';
import type { Agent, FleetEntry, RegisterAgentInput, RegisterAgentResult } from './types';

interface AgentsResp {
  agents: Agent[];
}

interface FleetResp {
  fleet: FleetEntry[];
}

export const listAgentsRequest = (): Promise<Agent[]> =>
  apiClient<AgentsResp>('/agents', { auth: true }).then((r) => r.agents);

export const registerAgentRequest = (input: RegisterAgentInput): Promise<RegisterAgentResult> =>
  apiClient<RegisterAgentResult>('/agents', {
    method: 'POST',
    auth: true,
    body: input,
  });

export const fetchFleetRequest = (): Promise<FleetEntry[]> =>
  apiClient<FleetResp>('/agents/fleet', { auth: true }).then((r) => r.fleet);
