import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  BrandLogo,
  BRAND_ASSETS,
  BRAND_NAME,
  BRAND_PRIMARY_COLOR,
  BRAND_THEME_COLOR,
} from './index';

describe('BrandLogo', () => {
  it('renders the full logo (mark + text) by default with an extra class', () => {
    const { container } = render(<BrandLogo className="nav" />);
    const root = container.querySelector('.brand-logo');
    expect(root).toHaveClass('nav');
    expect(root).not.toHaveAttribute('role');
    expect(root).toHaveTextContent(BRAND_NAME);
  });

  it('renders mark-only as an accessible image without the text label', () => {
    const { container } = render(<BrandLogo markOnly style={{ width: 20 }} />);
    const root = container.querySelector('.brand-logo');
    expect(root).toHaveAttribute('role', 'img');
    expect(root).toHaveAttribute('aria-label', BRAND_NAME);
    expect(root?.querySelector('.brand-logo__text')).toBeNull();
  });

  it('exposes the brand asset manifest', () => {
    expect(BRAND_ASSETS.ogDefault).toBe('/og/default.png');
    expect(BRAND_ASSETS.maskableIcon512).toBe('/icons/maskable-512.png');
    expect(BRAND_PRIMARY_COLOR).toBe(BRAND_THEME_COLOR);
  });
});
