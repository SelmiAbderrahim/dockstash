import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as client from '@shared/api/client';
import {
  deleteAgentRequest,
  fetchFleetRequest,
  listAgentsRequest,
  registerAgentRequest,
  rotateAgentKeyRequest,
} from './api';

vi.mock('@shared/api/client', () => ({ apiClient: vi.fn() }));
const apiClient = vi.mocked(client.apiClient);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fleet api wrappers', () => {
  it('listAgentsRequest fetches and unwraps agents', async () => {
    const agents = [
      { id: 'a1', name: 'web-1', host: 'vps1.example', port: 7443, status: 'online', lastSeenAt: null },
    ];
    apiClient.mockResolvedValue({ agents } as never);
    const result = await listAgentsRequest();
    expect(apiClient).toHaveBeenCalledWith('/agents', { auth: true });
    expect(result).toBe(agents);
  });

  it('registerAgentRequest posts the input and returns the one-time key payload', async () => {
    const payload = {
      agent: { id: 'a1', name: 'web-1', host: 'vps1.example', port: 7443, status: 'offline', lastSeenAt: null },
      apiKey: 'sk-once',
    };
    apiClient.mockResolvedValue(payload as never);
    const result = await registerAgentRequest({ name: 'web-1', host: 'vps1.example', port: 7443 });
    expect(apiClient).toHaveBeenCalledWith('/agents', {
      method: 'POST',
      auth: true,
      body: { name: 'web-1', host: 'vps1.example', port: 7443 },
    });
    expect(result).toBe(payload);
  });

  it('fetchFleetRequest fetches and unwraps the fleet', async () => {
    const fleet = [
      {
        id: 'a1',
        name: 'web-1',
        host: 'vps1.example',
        status: 'online',
        lastSeenAt: null,
        projectCount: 2,
        totalBytes: 100,
        snapshotCount: 4,
      },
    ];
    apiClient.mockResolvedValue({ fleet } as never);
    const result = await fetchFleetRequest();
    expect(apiClient).toHaveBeenCalledWith('/agents/fleet', { auth: true });
    expect(result).toBe(fleet);
  });

  it('rotateAgentKeyRequest posts to the rotate-key endpoint and returns the one-time key payload', async () => {
    const payload = {
      agent: { id: 'a1', name: 'web-1', host: 'vps1.example', port: 22, status: 'online', lastSeenAt: null },
      token: 'dsa_0123456789abcdef01234567.new',
    };
    apiClient.mockResolvedValue(payload as never);
    const result = await rotateAgentKeyRequest('a1');
    expect(apiClient).toHaveBeenCalledWith('/agents/a1/rotate-key', { method: 'POST', auth: true });
    expect(result).toBe(payload);
  });

  it('deleteAgentRequest DELETEs the agent by id', async () => {
    apiClient.mockResolvedValue(undefined as never);
    const result = await deleteAgentRequest('a1');
    expect(apiClient).toHaveBeenCalledWith('/agents/a1', { method: 'DELETE', auth: true });
    expect(result).toBeUndefined();
  });
});
