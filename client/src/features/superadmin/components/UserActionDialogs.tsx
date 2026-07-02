import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@shared/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@shared/ui/select';
import type { SuperadminUser } from '../types';

// Superadmin excluded — the account is bootstrap-only, never API-assignable.
export const ASSIGNABLE_ROLES = ['Member', 'Client', 'Owner', 'Admin'] as const;

export type UserDialog = 'role' | 'verify' | 'hold' | 'delete' | null;

interface ChangeRoleDialogProps {
  user: SuperadminUser;
  onConfirm: (role: string) => void;
  onCancel: () => void;
}

export const ChangeRoleDialog = ({ user, onConfirm, onCancel }: ChangeRoleDialogProps) => {
  const { t } = useTranslation('superadmin');
  const [role, setRole] = useState<string>(
    ASSIGNABLE_ROLES.includes(user.role as (typeof ASSIGNABLE_ROLES)[number])
      ? user.role
      : ASSIGNABLE_ROLES[0],
  );

  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('users.dialogs.roleTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('users.dialogs.roleDescription', { email: user.email })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger aria-label={t('users.dialogs.roleLabel')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSIGNABLE_ROLES.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {t('users.dialogs.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(role)}>
            {t('users.dialogs.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

interface ConfirmActionDialogProps {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** While true the dialog is locked: buttons disabled, confirm shows a spinner. */
  pending?: boolean;
}

export const ConfirmActionDialog = ({
  title,
  description,
  onConfirm,
  onCancel,
  pending = false,
}: ConfirmActionDialogProps) => {
  const { t } = useTranslation('superadmin');
  return (
    <AlertDialog open onOpenChange={(open) => !open && !pending && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={pending}>
            {t('users.dialogs.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              // Don't let Radix auto-close; the parent closes on success only.
              event.preventDefault();
              onConfirm();
            }}
            disabled={pending}
            aria-busy={pending}
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {t('users.dialogs.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
