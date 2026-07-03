import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOKEN_PLACEHOLDER, buildAgentInstallCommand, resolveAgentServerUrl } from './install-command';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('resolveAgentServerUrl', () => {
  it('strips the path from an absolute http VITE_API_BASE_URL', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.example.com/api');
    expect(resolveAgentServerUrl()).toBe('http://api.example.com');
  });

  it('strips the path from an absolute https VITE_API_BASE_URL', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com:8443/api');
    expect(resolveAgentServerUrl()).toBe('https://api.example.com:8443');
  });

  it('falls back to the page origin for a relative VITE_API_BASE_URL', () => {
    vi.stubEnv('VITE_API_BASE_URL', '/api');
    vi.stubGlobal('location', { origin: 'http://dashboard.example.com' });
    expect(resolveAgentServerUrl()).toBe('http://dashboard.example.com');
  });

  it('falls back to the page origin when VITE_API_BASE_URL is unset', () => {
    vi.stubEnv('VITE_API_BASE_URL', undefined);
    vi.stubGlobal('location', { origin: 'http://dashboard.example.com' });
    expect(resolveAgentServerUrl()).toBe('http://dashboard.example.com');
  });

  it('falls back to the page origin when VITE_API_BASE_URL is malformed', () => {
    // Matches the absolute-URL regex but fails `new URL()` parsing.
    vi.stubEnv('VITE_API_BASE_URL', 'http://');
    vi.stubGlobal('location', { origin: 'http://dashboard.example.com' });
    expect(resolveAgentServerUrl()).toBe('http://dashboard.example.com');
  });
});

describe('buildAgentInstallCommand', () => {
  it('bakes the real token into the command when provided', () => {
    const command = buildAgentInstallCommand({
      token: 'dsa_0123456789abcdef01234567.abc',
      serverUrl: 'http://dashboard.example.com',
    });
    expect(command).toContain('DOCKSTASH_AGENT_TOKEN: dsa_0123456789abcdef01234567.abc');
    expect(command).toContain('DOCKSTASH_URL: http://dashboard.example.com');
    expect(command).not.toContain(TOKEN_PLACEHOLDER);
  });

  it('emits the placeholder when no token is provided', () => {
    const command = buildAgentInstallCommand({ serverUrl: 'http://dashboard.example.com' });
    expect(command).toContain(`DOCKSTASH_AGENT_TOKEN: ${TOKEN_PLACEHOLDER}`);
  });

  it('produces the full compose + up one-paste as a single joined script', () => {
    const command = buildAgentInstallCommand({ serverUrl: 'http://dashboard.example.com' });
    expect(command.startsWith("cat > docker-compose.agent.yml <<'EOF'")).toBe(true);
    expect(command.endsWith('docker compose -f docker-compose.agent.yml up -d')).toBe(true);
    expect(command).toContain('image: selmiabderrahim/agent:latest');
  });
});
