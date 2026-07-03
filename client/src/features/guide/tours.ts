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
        advanceOn: 'click',
      },
      {
        // Lives in the register dialog's SUCCESS view — deliberately NOT a
        // DIALOG_TOUR_ANCHOR: auto-open would mount the form, not the reveal.
        // In the happy path (advanced from submit) the anchor is mounted;
        // a mid-tour resume falls back to the overlay's not-visible notice.
        route: '/fleet',
        target: 'agent-install-command',
        titleKey: 'tours.exploreFleet.steps.install.title',
        bodyKey: 'tours.exploreFleet.steps.install.body',
        placement: 'top',
      },
      {
        route: '/fleet',
        target: 'fleet-table-status',
        titleKey: 'tours.exploreFleet.steps.online.title',
        bodyKey: 'tours.exploreFleet.steps.online.body',
        placement: 'bottom',
      },
      {
        // Cross-route: sends the user from a registered agent to the Add-Project
        // flow, where the agent can be chosen as the backup target.
        route: '/projects',
        target: 'projects-add-button',
        titleKey: 'tours.exploreFleet.steps.addProject.title',
        bodyKey: 'tours.exploreFleet.steps.addProject.body',
        placement: 'bottom',
      },
    ],
  },
  {
    id: 'add-project',
    titleKey: 'tours.addProject.title',
    descriptionKey: 'tours.addProject.description',
    routePrefix: '/projects',
    steps: [
      {
        route: '/projects',
        target: 'projects-add-button',
        titleKey: 'tours.addProject.steps.add.title',
        bodyKey: 'tours.addProject.steps.add.body',
        placement: 'bottom',
        advanceOn: 'click',
      },
      {
        route: '/projects/new',
        target: 'add-target',
        titleKey: 'tours.addProject.steps.target.title',
        bodyKey: 'tours.addProject.steps.target.body',
        placement: 'bottom',
      },
      {
        route: '/projects/new',
        target: 'add-source-tabs',
        titleKey: 'tours.addProject.steps.source.title',
        bodyKey: 'tours.addProject.steps.source.body',
        placement: 'bottom',
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
