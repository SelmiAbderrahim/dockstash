import type { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireUserId } from '../../shared/utils/require-user-id.js';
import { HttpError } from '../../shared/utils/http-error.js';
import {
  getSettingsForUser,
  saveRetention,
  setEncryptionPassword,
  testStorage,
  upsertStorage,
  type SshProbe,
} from './settings.service.js';
import {
  savePasswordSchema,
  saveRetentionSchema,
  saveStorageSchema,
} from './settings.schema.js';
import { serializeRetention, serializeStorage } from './settings.serialize.js';

export interface SettingsControllerDeps {
  probe: SshProbe;
}

let deps: SettingsControllerDeps | null = null;

/** Wire the controller to a live SSH probe (called at boot). */
export function configureSettingsController(next: SettingsControllerDeps): void {
  deps = next;
}

/** For tests: forget the wiring so a fresh boot can re-configure. */
export function resetSettingsController(): void {
  deps = null;
}

/** Default wiring when the boot path never configured a probe. */
export function ensureConfigured(fallback: Partial<SettingsControllerDeps> = {}): void {
  if (deps) return;
  const probe =
    fallback.probe ??
    ({
      async connect() {
        throw HttpError.internal(
          'settings probe not configured — call configureSettingsController() first',
        );
      },
    } satisfies SshProbe);
  deps = { probe };
}

function requireDeps(): SettingsControllerDeps {
  ensureConfigured();
  // ensureConfigured always assigns; the assertion keeps TS honest.
  return deps as SettingsControllerDeps;
}

export const getStorage: RequestHandler = asyncHandler(async (req, res) => {
  const settings = await getSettingsForUser(requireUserId(req.user));
  res.status(200).json({ storage: serializeStorage(settings) });
});

export const putStorage: RequestHandler = asyncHandler(async (req, res) => {
  const input = saveStorageSchema.parse(req.body);
  const settings = await upsertStorage(requireUserId(req.user), input);
  res.status(200).json({ storage: serializeStorage(settings) });
});

export const postStorageTest: RequestHandler = asyncHandler(async (req, res) => {
  const { probe } = requireDeps();
  await testStorage(requireUserId(req.user), { probe, t: req.t });
  res.status(200).json({ ok: true });
});

export const getRetention: RequestHandler = asyncHandler(async (req, res) => {
  const settings = await getSettingsForUser(requireUserId(req.user));
  res.status(200).json({ retention: serializeRetention(settings) });
});

export const putRetention: RequestHandler = asyncHandler(async (req, res) => {
  const input = saveRetentionSchema.parse(req.body);
  const settings = await saveRetention(requireUserId(req.user), input);
  res.status(200).json({ retention: serializeRetention(settings) });
});

export const putEncryptionPassword: RequestHandler = asyncHandler(async (req, res) => {
  const input = savePasswordSchema.parse(req.body);
  await setEncryptionPassword(requireUserId(req.user), input.password);
  res.status(200).json({ ok: true });
});
