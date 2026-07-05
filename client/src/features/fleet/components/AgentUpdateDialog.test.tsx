import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { AgentUpdateDialog } from './AgentUpdateDialog';
import type { FleetEntry } from '../types';
import { i18n, initI18n } from '@shared/i18n';

const agent: FleetEntry = {
  id: 'a1',
  name: 'web-1',
  host: 'vps1.example',
  status: 'online',
  lastSeenAt: null,
  agentVersion: '0.2.1',
  outdated: true,
  projectCount: 1,
  totalBytes: 10,
  snapshotCount: 2,
};

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
});

const renderDialog = (props: Partial<React.ComponentProps<typeof AgentUpdateDialog>> = {}) =>
  render(
    <I18nextProvider i18n={i18n}>
      <AgentUpdateDialog agent={agent} onClose={() => {}} {...props} />
    </I18nextProvider>,
  );

describe('AgentUpdateDialog', () => {
  it('renders nothing when there is no agent', () => {
    renderDialog({ agent: null });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the pull + force-recreate update command with a copy button', () => {
    renderDialog();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Update agent')).toBeInTheDocument();
    const code = screen.getByText(/docker compose -f docker-compose\.agent\.yml pull/);
    expect(code.textContent).toContain('up -d --force-recreate');
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('copies the command and swaps the button to the copied state', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument(),
    );
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('docker compose -f docker-compose.agent.yml pull'),
    );
    vi.unstubAllGlobals();
  });

  it('closes (onClose) from the footer Close button', () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    // Radix renders its own top-right icon close too; the footer Close is the
    // plain text button (no svg icon).
    const footerClose = screen
      .getAllByRole('button', { name: 'Close' })
      .find((b) => !b.querySelector('svg'));
    fireEvent.click(footerClose!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
