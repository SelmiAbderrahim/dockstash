import type { RouteObject } from 'react-router-dom';
import { MarketingLayout } from './components/MarketingLayout';
import { Home } from './components/Home';
import { Pricing } from './components/Pricing';
import { AlternativesHub } from './components/AlternativesHub';
import { AlternativePage } from './components/AlternativePage';
import { VsPage } from './components/VsPage';
import { CompareCategoryPage } from './components/CompareCategoryPage';
import { GuidesHub } from './components/GuidesHub';
import { GuidePage } from './components/GuidePage';
import { UseCasePage } from './components/UseCasePage';
import { Security } from './components/Security';
import { Faq } from './components/Faq';
import { Privacy } from './components/Privacy';
import { Terms } from './components/Terms';
import { MARKETING_LOCALE_PREFIXES } from './useMarketingRoute';

/**
 * The marketing page tree, shared by the English (un-prefixed) branch and
 * one branch per non-default locale (/ar, /fr, …). Locale prefixes are
 * literal path segments — never a `:locale` param — so they cannot hijack
 * app routes like /login or /dashboard.
 */
const pages: RouteObject[] = [
  { index: true, element: <Home /> },
  { path: 'pricing', element: <Pricing /> },
  { path: 'alternatives', element: <AlternativesHub /> },
  { path: 'alternatives/:slug', element: <AlternativePage /> },
  { path: 'vs/:slug', element: <VsPage /> },
  {
    path: 'compare/self-hosted-backup-vs-cloud-backup',
    element: <CompareCategoryPage />,
  },
  { path: 'guides', element: <GuidesHub /> },
  { path: 'guides/:entry', element: <GuidePage /> },
  { path: 'backup/:entry', element: <UseCasePage /> },
  { path: 'security', element: <Security /> },
  { path: 'faq', element: <Faq /> },
  { path: 'privacy', element: <Privacy /> },
  { path: 'terms', element: <Terms /> },
];

export const marketingRoutes: RouteObject[] = [
  { element: <MarketingLayout />, children: pages },
  ...MARKETING_LOCALE_PREFIXES.map((locale) => ({
    path: locale,
    element: <MarketingLayout />,
    children: pages,
  })),
];
