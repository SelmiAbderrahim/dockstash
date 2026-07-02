import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SsrNotFound, SsrStatusProvider, type SsrStatusRef } from './SsrStatus';

describe('SsrStatus', () => {
  it('flips the status ref to 404 when rendered inside the provider', () => {
    const ref: SsrStatusRef = { statusCode: 200 };
    renderToString(
      <SsrStatusProvider value={ref}>
        <SsrNotFound />
      </SsrStatusProvider>,
    );
    expect(ref.statusCode).toBe(404);
  });

  it('is a no-op without a provider (browser)', () => {
    expect(renderToString(<SsrNotFound />)).toBe('');
  });
});
