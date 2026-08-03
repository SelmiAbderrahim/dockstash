import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { AgentInstallCommand } from './AgentInstallCommand';
import { TOKEN_PLACEHOLDER } from '../install-command';
import { i18n, initI18n } from '@shared/i18n';

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.stubGlobal('location', { origin: 'http://dashboard.example.com' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const renderCommand = (props: Partial<React.ComponentProps<typeof AgentInstallCommand>> = {}) =>
  render(
    <I18nextProvider i18n={i18n}>
      <AgentInstallCommand {...props} />
    </I18nextProvider>,
  );

describe('AgentInstallCommand', () => {
  it('renders the placeholder command when no token is given', () => {
    renderCommand();
    expect(screen.getByText('Install the agent')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(TOKEN_PLACEHOLDER))).toBeInTheDocument();
  });

  it('bakes the token into the command when given', () => {
    renderCommand({ token: 'dsa_test.test' });
    expect(screen.getByText(/dsa_test\.test/)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(TOKEN_PLACEHOLDER))).not.toBeInTheDocument();
  });

  it('copies the command to the clipboard and flips the button label', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderCommand({ token: 'dsa_test.test' });
    fireEvent.click(screen.getByRole('button', { name: /copy command/i }));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('dsa_test.test'),
    );
  });

  it('carries the data-tour anchor for the guide overlay', () => {
    const { container } = renderCommand();
    expect(container.querySelector('[data-tour="agent-install-command"]')).toBeInTheDocument();
  });
});
