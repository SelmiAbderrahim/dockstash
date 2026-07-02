import type { TourDefinition } from './types';

export const GUIDE_TOURS: TourDefinition[] = [
  {
    id: 'encryption-password',
    titleKey: 'tours.encryptionPassword.title',
    descriptionKey: 'tours.encryptionPassword.description',
    routePrefix: '/settings',
    steps: [
      {
        route: '/settings?tab=password',
        target: 'password-new',
        titleKey: 'tours.encryptionPassword.steps.new.title',
        bodyKey: 'tours.encryptionPassword.steps.new.body',
        placement: 'bottom',
        advanceOn: 'input',
      },
      {
        route: '/settings?tab=password',
        target: 'password-confirm',
        titleKey: 'tours.encryptionPassword.steps.confirm.title',
        bodyKey: 'tours.encryptionPassword.steps.confirm.body',
        placement: 'bottom',
        advanceOn: 'input',
      },
      {
        route: '/settings?tab=password',
        target: 'password-escrow',
        titleKey: 'tours.encryptionPassword.steps.escrow.title',
        bodyKey: 'tours.encryptionPassword.steps.escrow.body',
        placement: 'top',
      },
      {
        route: '/settings?tab=password',
        target: 'password-save',
        titleKey: 'tours.encryptionPassword.steps.save.title',
        bodyKey: 'tours.encryptionPassword.steps.save.body',
        placement: 'top',
      },
    ],
  },
  {
    id: 'configure-storage',
    titleKey: 'tours.configureStorage.title',
    descriptionKey: 'tours.configureStorage.description',
    routePrefix: '/settings',
    steps: [
      {
        route: '/settings?tab=storage',
        target: 'storage-host',
        titleKey: 'tours.configureStorage.steps.host.title',
        bodyKey: 'tours.configureStorage.steps.host.body',
        placement: 'bottom',
        advanceOn: 'input',
      },
      {
        route: '/settings?tab=storage',
        target: 'storage-key',
        titleKey: 'tours.configureStorage.steps.key.title',
        bodyKey: 'tours.configureStorage.steps.key.body',
        placement: 'top',
      },
      {
        route: '/settings?tab=storage',
        target: 'storage-save',
        titleKey: 'tours.configureStorage.steps.save.title',
        bodyKey: 'tours.configureStorage.steps.save.body',
        placement: 'top',
      },
    ],
  },
  {
    id: 'retention-policy',
    titleKey: 'tours.retentionPolicy.title',
    descriptionKey: 'tours.retentionPolicy.description',
    routePrefix: '/settings',
    steps: [
      {
        route: '/settings?tab=retention',
        target: 'retention-daily',
        titleKey: 'tours.retentionPolicy.steps.daily.title',
        bodyKey: 'tours.retentionPolicy.steps.daily.body',
        placement: 'bottom',
      },
      {
        route: '/settings?tab=retention',
        target: 'retention-save',
        titleKey: 'tours.retentionPolicy.steps.save.title',
        bodyKey: 'tours.retentionPolicy.steps.save.body',
        placement: 'top',
      },
    ],
  },
  {
    id: 'explore-fleet',
    titleKey: 'tours.exploreFleet.title',
    descriptionKey: 'tours.exploreFleet.description',
    routePrefix: '/fleet',
    steps: [
      {
        route: '/fleet',
        target: 'fleet-heading',
        titleKey: 'tours.exploreFleet.steps.overview.title',
        bodyKey: 'tours.exploreFleet.steps.overview.body',
        placement: 'bottom',
      },
      {
        route: '/fleet',
        target: 'fleet-register-button',
        titleKey: 'tours.exploreFleet.steps.register.title',
        bodyKey: 'tours.exploreFleet.steps.register.body',
        placement: 'bottom',
        advanceOn: 'click',
      },
      {
        route: '/fleet',
        target: 'agent-name-input',
        titleKey: 'tours.exploreFleet.steps.name.title',
        bodyKey: 'tours.exploreFleet.steps.name.body',
        placement: 'bottom',
        advanceOn: 'input',
      },
      {
        route: '/fleet',
        target: 'agent-host-input',
        titleKey: 'tours.exploreFleet.steps.host.title',
        bodyKey: 'tours.exploreFleet.steps.host.body',
        placement: 'bottom',
        advanceOn: 'input',
      },
      {
        route: '/fleet',
        target: 'agent-port-input',
        titleKey: 'tours.exploreFleet.steps.port.title',
        bodyKey: 'tours.exploreFleet.steps.port.body',
        placement: 'bottom',
        advanceOn: 'input',
      },
      {
        route: '/fleet',
        target: 'agent-register-submit',
        titleKey: 'tours.exploreFleet.steps.submit.title',
        bodyKey: 'tours.exploreFleet.steps.submit.body',
        placement: 'top',
      },
    ],
  },
  {
    id: 'explore-snapshots',
    titleKey: 'tours.exploreSnapshots.title',
    descriptionKey: 'tours.exploreSnapshots.description',
    routePrefix: '/snapshots',
    steps: [
      {
        route: '/snapshots',
        target: 'snapshots-heading',
        titleKey: 'tours.exploreSnapshots.steps.overview.title',
        bodyKey: 'tours.exploreSnapshots.steps.overview.body',
        placement: 'bottom',
      },
    ],
  },
];

export const findTour = (id: string | null): TourDefinition | null => {
  if (!id) return null;
  return GUIDE_TOURS.find((tour) => tour.id === id) ?? null;
};

/**
 * Panel ordering: tours for the current page first, then other uncompleted
 * tours, completed tours sink to the bottom. Stable within each group.
 */
export const sortToursForRoute = (
  pathname: string,
  completed: readonly string[],
): TourDefinition[] => {
  const rank = (tour: TourDefinition): number => {
    const here = pathname.startsWith(tour.routePrefix) ? 0 : 1;
    const done = completed.includes(tour.id) ? 2 : 0;
    return here + done;
  };
  return [...GUIDE_TOURS].sort((a, b) => rank(a) - rank(b));
};
