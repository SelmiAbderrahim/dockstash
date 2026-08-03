import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PROJECT_ROOT,
  TOKEN_PLACEHOLDER,
  buildAgentInstallCommand,
  buildAgentUpdateCommand,
  normalizeProjectRoot,
  parseProjectRootsInput,
  resolveAgentServerUrl,
} from './install-command';

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
      token: 'dsa_test.test',
      serverUrl: 'http://dashboard.example.com',
    });
    expect(command).toContain('DOCKSTASH_AGENT_TOKEN: dsa_test.test');
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
    expect(command).toContain('docker compose -f docker-compose.agent.yml pull');
    expect(command.endsWith('docker compose -f docker-compose.agent.yml up -d --force-recreate')).toBe(
      true,
    );
    expect(command).toContain('image: selmiabderrahim/agent:latest');
    // DB restores bounce the target container — the proxy must allow restarts.
    expect(command).toContain('ALLOW_RESTARTS: 1');
  });

  it('mounts /var/www rw and lists it in DOCKSTASH_PROJECT_ROOTS by default', () => {
    const command = buildAgentInstallCommand({ serverUrl: 'http://dashboard.example.com' });
    expect(command).toContain('DOCKSTASH_PROJECT_ROOTS: /var/www');
    expect(command).toContain('- /var/www:/var/www:rw');
  });

  it('mounts every chosen root and joins them in DOCKSTASH_PROJECT_ROOTS', () => {
    const command = buildAgentInstallCommand({
      serverUrl: 'http://dashboard.example.com',
      roots: ['/var/www', '/opt/apps'],
    });
    expect(command).toContain('DOCKSTASH_PROJECT_ROOTS: /var/www,/opt/apps');
    expect(command).toContain('- /var/www:/var/www:rw');
    expect(command).toContain('- /opt/apps:/opt/apps:rw');
  });

  it('falls back to the default root when an empty roots array is passed', () => {
    const command = buildAgentInstallCommand({
      serverUrl: 'http://dashboard.example.com',
      roots: [],
    });
    expect(command).toContain(`DOCKSTASH_PROJECT_ROOTS: ${DEFAULT_PROJECT_ROOT}`);
  });
});

describe('buildAgentUpdateCommand', () => {
  it('emits the pull + force-recreate two-liner, no token', () => {
    const command = buildAgentUpdateCommand();
    expect(command).toContain('docker compose -f docker-compose.agent.yml pull');
    expect(command).toContain('docker compose -f docker-compose.agent.yml up -d --force-recreate');
    expect(command).not.toContain(TOKEN_PLACEHOLDER);
  });
});

describe('normalizeProjectRoot', () => {
  it('normalizes and strips trailing slashes', () => {
    expect(normalizeProjectRoot('/var/www/')).toBe('/var/www');
    expect(normalizeProjectRoot('  /opt//apps  ')).toBe('/opt/apps');
  });

  it('rejects empties, NUL, traversal, relative paths, and the filesystem root', () => {
    expect(normalizeProjectRoot('')).toBeNull();
    expect(normalizeProjectRoot('   ')).toBeNull();
    expect(normalizeProjectRoot('/a\0b')).toBeNull();
    expect(normalizeProjectRoot('/a/../b')).toBeNull();
    expect(normalizeProjectRoot('relative')).toBeNull();
    expect(normalizeProjectRoot('/')).toBeNull();
    expect(normalizeProjectRoot('///')).toBeNull();
  });

  it('rejects denied system prefixes, exact and nested, but allows lookalikes', () => {
    for (const denied of ['/proc', '/sys', '/dev', '/etc', '/boot', '/run']) {
      expect(normalizeProjectRoot(denied)).toBeNull();
      expect(normalizeProjectRoot(`${denied}/sub`)).toBeNull();
    }
    expect(normalizeProjectRoot('/etcetera')).toBe('/etcetera');
  });
});

describe('parseProjectRootsInput', () => {
  it('splits on commas and newlines, dedups, and keeps order', () => {
    expect(parseProjectRootsInput('/var/www, /opt/apps\n/var/www/')).toEqual({
      roots: ['/var/www', '/opt/apps'],
      invalid: [],
    });
  });

  it('skips empty segments and collects invalid entries', () => {
    expect(parseProjectRootsInput(',/var/www,,relative,/etc/nginx')).toEqual({
      roots: ['/var/www'],
      invalid: ['relative', '/etc/nginx'],
    });
  });
});
