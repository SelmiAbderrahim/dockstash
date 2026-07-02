/**
 * Build the one-paste install command shown after agent registration. The
 * daemon must reach the API host, so we derive the server URL from
 * `VITE_API_BASE_URL` (stripping any `/api` suffix) and fall back to the
 * current page origin — never a hardcoded URL.
 */

const TOKEN_PLACEHOLDER = '<AGENT_TOKEN>';

export function resolveAgentServerUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (typeof base === 'string' && /^https?:\/\//i.test(base)) {
    try {
      return new URL(base).origin;
    } catch {
      // malformed absolute URL — fall through to the page origin
    }
  }
  return window.location.origin;
}

export interface InstallCommandOptions {
  token?: string;
  serverUrl: string;
}

/**
 * A single copy-paste that writes the compose file and brings the agent up.
 * When `token` is absent (recovery / setup view) a literal placeholder is
 * emitted for the user to replace.
 */
export function buildAgentInstallCommand({ token, serverUrl }: InstallCommandOptions): string {
  const value = token ?? TOKEN_PLACEHOLDER;
  return [
    "cat > docker-compose.agent.yml <<'EOF'",
    'services:',
    '  docker-socket-proxy:',
    '    image: tecnativa/docker-socket-proxy:0.3.0',
    '    restart: unless-stopped',
    '    environment:',
    '      CONTAINERS: 1',
    '      EXEC: 1',
    '      POST: 1',
    '      INFO: 1',
    '    volumes:',
    '      - /var/run/docker.sock:/var/run/docker.sock:ro',
    '    security_opt: [no-new-privileges:true]',
    '    cap_drop: [ALL]',
    '  agent:',
    '    image: dockstash/agent:latest',
    '    restart: unless-stopped',
    '    depends_on: [docker-socket-proxy]',
    '    environment:',
    `      DOCKSTASH_URL: ${serverUrl}`,
    `      DOCKSTASH_AGENT_TOKEN: ${value}`,
    '      DOCKER_HOST: tcp://docker-socket-proxy:2375',
    '    volumes:',
    '      - /var/www:/var/www:ro',
    '    tmpfs: [/tmp]',
    '    security_opt: [no-new-privileges:true]',
    '    cap_drop: [ALL]',
    'EOF',
    'docker compose -f docker-compose.agent.yml up -d',
  ].join('\n');
}

export { TOKEN_PLACEHOLDER };
