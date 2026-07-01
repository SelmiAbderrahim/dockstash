import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { Project } from '../backups/backups.model.js';
import { User } from '../users/users.model.js';
import { setResendTransport, type EmailMessage } from '../communication/index.js';
import { sendFailureAlert } from './alert.service.js';
import { runHeartbeatSweep } from './heartbeat.service.js';
import { env } from '../../config/env.js';

async function seedProject(opts: {
  ownerLang?: 'en' | 'fr' | 'ar' | 'zh';
  lastSuccessAt?: Date | null;
  lastHeartbeatAlertAt?: Date | null;
  name?: string;
} = {}) {
  const user = await User.create({
    email: `owner-${Date.now()}-${Math.floor(1e6 * Math.random())}@x.co`,
    password: 'hash',
    language: opts.ownerLang ?? 'en',
  });
  const project = await Project.create({
    owner: user._id,
    name: opts.name ?? 'proj',
    path: '/var/www/x',
    plan: { paths: ['/var/www/x'], databases: [], configs: [] },
    repoPasswordEnc: {
      ciphertext: 'x',
      iv: 'y',
      authTag: 'z',
      keyVersion: 1,
    },
    lastSuccessAt: opts.lastSuccessAt ?? null,
    lastHeartbeatAlertAt: opts.lastHeartbeatAlertAt ?? null,
  });
  return { user, project };
}

const sent: EmailMessage[] = [];
const originalKey = env.RESEND_API_KEY;
const originalFrom = env.RESEND_FROM;
const originalWebhook = env.ALERT_WEBHOOK_URL;

beforeAll(async () => {
  await startMemoryMongo();
  (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = 'k';
  (env as { RESEND_FROM?: string }).RESEND_FROM = 'no-reply@x';
  setResendTransport(async (msg) => {
    sent.push(msg);
    return { delivered: true };
  });
});

afterAll(async () => {
  await stopMemoryMongo();
  setResendTransport(null);
  (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = originalKey;
  (env as { RESEND_FROM?: string }).RESEND_FROM = originalFrom;
  (env as { ALERT_WEBHOOK_URL?: string }).ALERT_WEBHOOK_URL = originalWebhook;
});

beforeEach(async () => {
  await clearCollections();
  sent.length = 0;
});

describe('sendFailureAlert', () => {
  it('sends an email for backup, restore, and drill failure kinds — one per call', async () => {
    const { project } = await seedProject({
      lastSuccessAt: new Date('2027-01-01T00:00:00Z'),
      name: 'my-project',
    });

    await sendFailureAlert({
      projectId: String(project._id),
      kind: 'backup',
      error: 'boom-backup',
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.subject).toContain('my-project');
    expect(sent[0]?.text).toContain('boom-backup');
    expect(sent[0]?.text).toContain('2027-01-01');

    sent.length = 0;
    await sendFailureAlert({
      projectId: String(project._id),
      kind: 'restore',
      error: 'boom-restore',
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain('boom-restore');

    sent.length = 0;
    await sendFailureAlert({
      projectId: String(project._id),
      kind: 'drill',
      error: 'boom-drill',
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain('boom-drill');
  });

  it('skips the email channel when the plan does not include email alerts', async () => {
    const { project } = await seedProject({ name: 'gated' });
    await sendFailureAlert(
      { projectId: String(project._id), kind: 'backup', error: 'e' },
      { emailAllowedFor: async () => false },
    );
    // Email is a paid feature — no email delivered for a plan without it.
    expect(sent).toHaveLength(0);
  });

  it('renders in the owner language', async () => {
    const { project } = await seedProject({ ownerLang: 'fr' });
    await sendFailureAlert({
      projectId: String(project._id),
      kind: 'backup',
      error: 'oops',
    });
    expect(sent[0]?.subject).toMatch(/ÉCHEC/);
  });

  it('is a no-op for a non-existent project (logs, does not throw)', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    await expect(
      sendFailureAlert({ projectId: fakeId, kind: 'backup', error: 'x' }),
    ).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
  });

  it('skips email when owner has no email (never happens in practice) — logs no crash', async () => {
    const { project } = await seedProject();
    // Remove the owner
    await User.deleteMany({});
    await sendFailureAlert({
      projectId: String(project._id),
      kind: 'backup',
      error: 'x',
    });
    // No sent emails and no throw
    expect(sent).toHaveLength(0);
  });

  it('POSTs to ALERT_WEBHOOK_URL when configured — injected poster', async () => {
    (env as { ALERT_WEBHOOK_URL?: string }).ALERT_WEBHOOK_URL = 'https://hook.example';
    const posts: unknown[] = [];
    const { project } = await seedProject();
    await sendFailureAlert(
      {
        projectId: String(project._id),
        kind: 'backup',
        error: 'e',
      },
      {
        webhookPoster: async (payload) => {
          posts.push(payload);
        },
      },
    );
    expect(posts).toHaveLength(1);
    (env as { ALERT_WEBHOOK_URL?: string }).ALERT_WEBHOOK_URL = originalWebhook;
  });

  it('POSTs to ALERT_WEBHOOK_URL via default httpTransport when no poster injected', async () => {
    (env as { ALERT_WEBHOOK_URL?: string }).ALERT_WEBHOOK_URL = 'https://hook.example';
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as never).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    } as unknown as Response);
    const { project } = await seedProject();
    await sendFailureAlert({
      projectId: String(project._id),
      kind: 'drill',
      error: 'e',
    });
    // sendEmail also fires fetch via Resend HTTP transport — but we injected
    // a resend transport at boot so Resend won't call fetch; the only
    // fetch here is the webhook POST.
    const calls = fetchSpy.mock.calls;
    const webhookCall = calls.find(
      ([url]) => typeof url === 'string' && url.includes('hook.example'),
    );
    expect(webhookCall).toBeDefined();
    fetchSpy.mockRestore();
    (env as { ALERT_WEBHOOK_URL?: string }).ALERT_WEBHOOK_URL = originalWebhook;
  });

  it('logs and continues when the webhook POST returns non-2xx', async () => {
    (env as { ALERT_WEBHOOK_URL?: string }).ALERT_WEBHOOK_URL = 'https://hook.example';
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as never).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'err',
    } as unknown as Response);
    const { project } = await seedProject();
    await sendFailureAlert({
      projectId: String(project._id),
      kind: 'backup',
      error: 'e',
    });
    fetchSpy.mockRestore();
    (env as { ALERT_WEBHOOK_URL?: string }).ALERT_WEBHOOK_URL = originalWebhook;
  });

  it('swallows email transport failure — never crashes caller', async () => {
    setResendTransport(async () => {
      throw new Error('sendgrid-down');
    });
    const { project } = await seedProject();
    await expect(
      sendFailureAlert({ projectId: String(project._id), kind: 'backup', error: 'e' }),
    ).resolves.toBeUndefined();
    // restore
    setResendTransport(async (msg) => {
      sent.push(msg);
      return { delivered: true };
    });
  });

  it('swallows webhook poster throw', async () => {
    (env as { ALERT_WEBHOOK_URL?: string }).ALERT_WEBHOOK_URL = 'https://hook.example';
    const { project } = await seedProject();
    await expect(
      sendFailureAlert(
        { projectId: String(project._id), kind: 'backup', error: 'e' },
        {
          webhookPoster: async () => {
            throw new Error('broke');
          },
        },
      ),
    ).resolves.toBeUndefined();
    (env as { ALERT_WEBHOOK_URL?: string }).ALERT_WEBHOOK_URL = originalWebhook;
  });
});

describe('runHeartbeatSweep', () => {
  const HOUR = 60 * 60 * 1000;

  it('alerts a project whose lastSuccessAt is older than the threshold', async () => {
    const now = new Date('2027-02-01T00:00:00Z');
    const stale = new Date(now.getTime() - 48 * HOUR);
    const { project } = await seedProject({ lastSuccessAt: stale });
    const res = await runHeartbeatSweep({ now, thresholdHours: 24 });
    expect(res.alertsSent).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.subject).toMatch(/Silent stall|no backup/);
    const reloaded = await Project.findById(project._id);
    expect(reloaded?.lastHeartbeatAlertAt).toBeTruthy();
  });

  it('skips the heartbeat email for a plan without email alerts', async () => {
    const now = new Date('2027-02-01T00:00:00Z');
    const stale = new Date(now.getTime() - 48 * HOUR);
    await seedProject({ lastSuccessAt: stale });
    const res = await runHeartbeatSweep({
      now,
      thresholdHours: 24,
      emailAllowedFor: async () => false,
    });
    // No email delivered — but the stall is still recorded (handled/deduped).
    expect(sent).toHaveLength(0);
    expect(res.projectsScanned).toBe(1);
  });

  it('does NOT alert when the last success is fresh', async () => {
    const now = new Date('2027-02-01T00:00:00Z');
    const fresh = new Date(now.getTime() - 1 * HOUR);
    await seedProject({ lastSuccessAt: fresh });
    const res = await runHeartbeatSweep({ now, thresholdHours: 24 });
    expect(res.alertsSent).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('alerts a never-succeeded project', async () => {
    const now = new Date('2027-02-01T00:00:00Z');
    await seedProject({ lastSuccessAt: null });
    const res = await runHeartbeatSweep({ now, thresholdHours: 24 });
    expect(res.alertsSent).toBe(1);
  });

  it('does NOT re-alert within the dedupe window', async () => {
    const now = new Date('2027-02-01T00:00:00Z');
    const stale = new Date(now.getTime() - 48 * HOUR);
    await seedProject({
      lastSuccessAt: stale,
      lastHeartbeatAlertAt: new Date(now.getTime() - 1 * HOUR),
    });
    const res = await runHeartbeatSweep({ now, thresholdHours: 24 });
    expect(res.alertsSent).toBe(0);
    expect(res.suppressed).toBe(1);
  });

  it('re-alerts once the dedupe window elapses', async () => {
    const now = new Date('2027-02-01T00:00:00Z');
    const stale = new Date(now.getTime() - 96 * HOUR);
    await seedProject({
      lastSuccessAt: stale,
      lastHeartbeatAlertAt: new Date(now.getTime() - 48 * HOUR),
    });
    const res = await runHeartbeatSweep({ now, thresholdHours: 24 });
    expect(res.alertsSent).toBe(1);
  });

  it('uses env.ALERT_HEARTBEAT_HOURS when thresholdHours is not provided', async () => {
    const now = new Date('2027-02-01T00:00:00Z');
    const stale = new Date(now.getTime() - (env.ALERT_HEARTBEAT_HOURS + 1) * HOUR);
    await seedProject({ lastSuccessAt: stale });
    const res = await runHeartbeatSweep({ now });
    expect(res.alertsSent).toBe(1);
  });

  it('handles a missing owner without crashing', async () => {
    const now = new Date('2027-02-01T00:00:00Z');
    const stale = new Date(now.getTime() - 48 * HOUR);
    const { project } = await seedProject({ lastSuccessAt: stale });
    await User.deleteMany({});
    const res = await runHeartbeatSweep({ now, thresholdHours: 24 });
    // still stamps lastHeartbeatAlertAt so future sweeps dedupe
    expect(res.alertsSent).toBe(1);
    const reloaded = await Project.findById(project._id);
    expect(reloaded?.lastHeartbeatAlertAt).toBeTruthy();
  });

  it('reports zero when there are no projects', async () => {
    const res = await runHeartbeatSweep({ now: new Date(), thresholdHours: 24 });
    expect(res).toEqual({ projectsScanned: 0, alertsSent: 0, suppressed: 0 });
  });

  it('swallows email transport failure — sweep does not throw', async () => {
    const now = new Date('2027-02-01T00:00:00Z');
    const stale = new Date(now.getTime() - 48 * HOUR);
    await seedProject({ lastSuccessAt: stale });
    setResendTransport(async () => {
      throw new Error('down');
    });
    await expect(
      runHeartbeatSweep({ now, thresholdHours: 24 }),
    ).resolves.toBeDefined();
    setResendTransport(async (msg) => {
      sent.push(msg);
      return { delivered: true };
    });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
