import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { AgentKeyReveal } from './AgentKeyReveal';
import { i18n, initI18n } from '@shared/i18n';

const TOKEN = 'dsa_0123456789abcdef01234567.abc';

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.stubGlobal('location', { origin: 'http://dashboard.example.com' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const renderReveal = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <AgentKeyReveal token={TOKEN} />
    </I18nextProvider>,
  );

describe('AgentKeyReveal', () => {
  it('shows the destructive warning and the token', () => {
    renderReveal();
    expect(screen.getByText(/shown once and can never be retrieved again/)).toBeInTheDocument();
    expect(screen.getByText(TOKEN)).toBeInTheDocument();
    expect(screen.getByTestId('agent-api-key')).toBeInTheDocument();
  });

  it('renders the install command with the token baked in', () => {
    renderReveal();
    // The token appears once in its own <code> and once inside the install
    // command script — both must be present.
    const tokenMatches = screen.getAllByText((_, node) => node?.textContent === TOKEN);
    expect(tokenMatches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/DOCKSTASH_AGENT_TOKEN: dsa_0123456789abcdef01234567\.abc/)).toBeInTheDocument();
    expect(screen.getByText('Install the agent')).toBeInTheDocument();
  });

  it('copies the token to the clipboard and flips the button label', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderReveal();
    // Two "Copy" buttons exist: the key reveal's own, and the nested install command's.
    fireEvent.click(screen.getAllByRole('button', { name: 'Copy' })[0]!);
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(TOKEN);
  });
});
