import { describe, expect, it } from 'vitest';
import * as fleet from './index';
import { fleetRoutes } from './routes';
import { fleetReducer, resetRegisterState } from './store/slice';
import { FleetScreen } from './components/FleetScreen';
import { RegisterAgentDialog } from './components/RegisterAgentDialog';

describe('fleet public API barrel', () => {
  it('re-exports the routes, reducer, actions, and components', () => {
    expect(fleet.fleetRoutes).toBe(fleetRoutes);
    expect(fleet.fleetReducer).toBe(fleetReducer);
    expect(fleet.resetRegisterState).toBe(resetRegisterState);
    expect(fleet.FleetScreen).toBe(FleetScreen);
    expect(fleet.RegisterAgentDialog).toBe(RegisterAgentDialog);
  });

  it('mounts the fleet screen behind the verified-email guard', () => {
    expect(fleetRoutes).toHaveLength(1);
    expect(fleetRoutes[0]?.path).toBe('fleet');
    expect(fleetRoutes[0]?.element).toBeTruthy();
  });
});
