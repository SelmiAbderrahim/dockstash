import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import { ResticLogPanel } from './ResticLogPanel';
import { i18n, initI18n } from '@shared/i18n';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));
const ioMock = vi.mocked(io);

interface FakeSocket {
  socket: Socket;
  handlers: Record<string, (arg: unknown) => void>;
  disconnect: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
}

const makeFakeSocket = (): FakeSocket => {
  const handlers: Record<string, (arg: unknown) => void> = {};
  const disconnect = vi.fn();
  const removeAllListeners = vi.fn();
  const socket = {
    on: vi.fn((event: string, cb: (arg: unknown) => void) => {
      handlers[event] = cb;
      return socket;
    }),
    emit: vi.fn(),
    removeAllListeners,
    disconnect,
  } as unknown as Socket;
  return { socket, handlers, disconnect, removeAllListeners };
};

let fake: FakeSocket;

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
  document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  fake = makeFakeSocket();
  ioMock.mockReturnValue(fake.socket);
});

const renderPanel = (props: React.ComponentProps<typeof ResticLogPanel>) =>
  render(
    <I18nextProvider i18n={i18n}>
      <ResticLogPanel {...props} />
    </I18nextProvider>,
  );

describe('ResticLogPanel', () => {
  it('renders nothing when there is no job id', () => {
    const { container } = renderPanel({ jobId: null });
    expect(container.firstChild).toBeNull();
  });

  it('streams log lines and reaches the completed state', () => {
    const onDone = vi.fn();
    renderPanel({ jobId: 'j1', onDone });
    expect(screen.getByText('Running…')).toBeInTheDocument();

    act(() => {
      fake.handlers.log!({ jobId: 'j1', line: 'line one' });
      fake.handlers.log!({ jobId: 'j1', line: 'line two' });
    });
    expect(screen.getByTestId('restic-log-stream')).toHaveTextContent('line one');
    expect(screen.getByTestId('restic-log-stream')).toHaveTextContent('line two');

    act(() => {
      fake.handlers.done!({ jobId: 'j1', ok: true, detail: 'all good' });
    });
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(onDone).toHaveBeenCalledWith(true, 'all good');
  });

  it('renders a custom title and shows the failed terminal state', () => {
    renderPanel({ jobId: 'j2', title: 'Restore output' });
    expect(screen.getByText('Restore output')).toBeInTheDocument();
    act(() => {
      fake.handlers.failed!({ jobId: 'j2', detail: 'oops' });
    });
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('surfaces a stream error via an alert', () => {
    renderPanel({ jobId: 'j3' });
    act(() => {
      fake.handlers.connect_error!(new Error('socket down'));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('socket down');
  });

  it('disconnects the socket on unmount', () => {
    const { unmount } = renderPanel({ jobId: 'j4' });
    unmount();
    expect(fake.disconnect).toHaveBeenCalled();
  });
});
