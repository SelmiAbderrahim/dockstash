import mongoose, { type InferSchemaType, type HydratedDocument } from 'mongoose';

export const ROLE_MEMBER = 'Member';
export const ROLE_CLIENT = 'Client';
export const ROLE_OWNER = 'Owner';
export const ROLE_ADMIN = 'Admin';

export const ROLES = [ROLE_MEMBER, ROLE_CLIENT, ROLE_OWNER, ROLE_ADMIN] as const;
export type Role = (typeof ROLES)[number];

const ROLE_RANK: Record<Role, number> = {
  [ROLE_MEMBER]: 1,
  [ROLE_CLIENT]: 2,
  [ROLE_OWNER]: 3,
  [ROLE_ADMIN]: 4,
};

export function getRoleRank(role: string | undefined): number {
  if (!role) return 0;
  return ROLE_RANK[role as Role] ?? 0;
}

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    profile: {
      firstName: { type: String, default: '' },
      lastName: { type: String, default: '' },
    },
    role: {
      type: String,
      enum: ROLES,
      default: ROLE_MEMBER,
    },
    stripe: {
      customerId: { type: String, default: '' },
      subscriptionId: { type: String, default: '' },
      lastFour: { type: String, default: '' },
      plan: { type: String, default: '' },
      activeUntil: { type: Date },
    },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof userSchema>;
export type UserHydrated = HydratedDocument<UserDocument>;

export const User = mongoose.model('User', userSchema);
