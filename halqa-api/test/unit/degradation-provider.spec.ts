import { DegradationService } from '../../src/ai/degradation/degradation.service';
import { EventBus } from '../../src/telemetry/event-bus';

/**
 * A failing provider used to be invisible: `evaluate()` was only ever called with
 * `quotaExhausted`, so every model call could fail while /degradation reported green.
 * These pin the rungs the router now reports.
 */
const bus = { emit: jest.fn().mockResolvedValue(undefined) } as unknown as EventBus;

describe('degradation ladder', () => {
  let svc: DegradationService;
  beforeEach(() => {
    svc = new DegradationService();
    (bus.emit as jest.Mock).mockClear();
  });

  it('starts green', () => {
    expect(svc.getMode()).toBe('green');
  });

  it('maps a healthy provider to green', async () => {
    await svc.evaluate({ bus, sessionId: 'S-1', circleId: 'C-1', lAvailable: true, quotaExhausted: false, serviceDown: false });
    expect(svc.getMode()).toBe('green');
  });

  it('maps a throttle to orange, not green', async () => {
    // lAvailable:false is how the router reports reduced C capacity.
    await svc.evaluate({ bus, sessionId: 'S-1', circleId: 'C-1', lAvailable: false, quotaExhausted: false, serviceDown: false });
    expect(svc.getMode()).toBe('orange');
  });

  it('maps quota exhaustion to red', async () => {
    await svc.evaluate({ bus, sessionId: 'S-1', circleId: 'C-1', lAvailable: true, quotaExhausted: true, serviceDown: false });
    expect(svc.getMode()).toBe('red');
  });

  it('maps a service outage to black', async () => {
    await svc.evaluate({ bus, sessionId: 'S-1', circleId: 'C-1', lAvailable: true, quotaExhausted: false, serviceDown: true });
    expect(svc.getMode()).toBe('black');
  });

  it('emits fallback_state only when the rung changes', async () => {
    await svc.evaluate({ bus, sessionId: 'S-1', circleId: 'C-1', lAvailable: false, quotaExhausted: false, serviceDown: false });
    await svc.evaluate({ bus, sessionId: 'S-1', circleId: 'C-1', lAvailable: false, quotaExhausted: false, serviceDown: false });
    const events = (bus.emit as jest.Mock).mock.calls.filter(([e]) => e.type === 'fallback_state');
    expect(events).toHaveLength(1);
    expect(events[0][0].payload).toEqual({ from: 'green', to: 'orange' });
  });

  it('a forced mode wins over the derived one', async () => {
    svc.force('black');
    await svc.evaluate({ bus, sessionId: 'S-1', circleId: 'C-1', lAvailable: true, quotaExhausted: false, serviceDown: false });
    expect(svc.getMode()).toBe('black');
    svc.clearForce();
    expect(svc.getMode()).toBe('green');
  });
});
