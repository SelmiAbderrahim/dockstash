import { selectAuthenticated } from '@features/auth';
import { useAppSelector } from '@shared/hooks/redux';
import { selectGuideEnabled } from '../store/selectors';
import { GuideLauncher } from './GuideLauncher';
import { GuidePanel } from './GuidePanel';
import { TourOverlay } from './TourOverlay';

/**
 * Composition root mounted once in AppLayout. AppLayout also hosts the
 * unauthenticated auth routes, so visibility is gated here.
 */
export const GuideWidget = () => {
  const authenticated = useAppSelector(selectAuthenticated);
  const enabled = useAppSelector(selectGuideEnabled);
  if (!authenticated || !enabled) return null;
  return (
    <>
      <GuideLauncher />
      <GuidePanel />
      <TourOverlay />
    </>
  );
};
