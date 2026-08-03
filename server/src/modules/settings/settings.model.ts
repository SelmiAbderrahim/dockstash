import mongoose, { type InferSchemaType, type HydratedDocument } from 'mongoose';

// Mirrors the crypto EncryptedSecret envelope (see shared/crypto). SSH private
// keys and the default repo password are stored encrypted at rest, never in
// plaintext.
const encryptedSecretSchema = new mongoose.Schema(
  {
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    keyVersion: { type: Number, required: true },
  },
  { _id: false },
);

const retentionSchema = new mongoose.Schema(
  {
    keepDaily: { type: Number, required: true, default: 7 },
    keepWeekly: { type: Number, required: true, default: 4 },
    keepMonthly: { type: Number, required: true, default: 6 },
  },
  { _id: false },
);

const storageSettingsSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    // Empty until the user saves a storage config — a row may exist with only
    // retention or an encryption password. `configured` is derived, not stored.
    host: { type: String, default: '', trim: true },
    user: { type: String, default: '', trim: true },
    port: { type: Number, required: true, default: 22 },
    basePath: { type: String, required: true, default: '/backups' },
    // Pinned host-key fingerprint (`sha256:BASE64`). Empty until the first
    // successful connection test pins it — never auto-accepted after that.
    hostKeyFingerprint: { type: String, default: '' },
    // Full known_hosts line captured at pin time. The restic runner writes it
    // to a per-user UserKnownHostsFile so ssh can verify with
    // StrictHostKeyChecking=yes (a bare fingerprint cannot populate
    // known_hosts).
    hostKeyLine: { type: String, default: '' },
    // SSH private key for the storage VPS, encrypted at rest.
    sshKeyEnc: { type: encryptedSecretSchema, default: null },
    retention: { type: retentionSchema, required: true, default: () => ({}) },
    // Default Restic repository password applied to new projects, encrypted.
    defaultRepoPasswordEnc: { type: encryptedSecretSchema, default: null },
    lastTestOk: { type: Boolean, default: null },
    lastTestAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type StorageSettingsDocument = InferSchemaType<typeof storageSettingsSchema>;
export type StorageSettingsHydrated = HydratedDocument<StorageSettingsDocument>;

export const StorageSettings =
  (mongoose.models.StorageSettings as mongoose.Model<StorageSettingsDocument>) ||
  mongoose.model('StorageSettings', storageSettingsSchema);
