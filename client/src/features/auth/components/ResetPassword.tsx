import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { useDocumentTitle } from '@shared/hooks/useDocumentTitle';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@shared/ui/card';
import { performPasswordReset } from '../store/thunks';
import { clearError, clearMessage } from '../store/slice';
import { selectAuthError, selectAuthMessage, selectAuthenticated } from '../store/selectors';

const resetPasswordSchema = z
  .object({
    password: z.string().min(1, 'Please enter a new password'),
    passwordConfirm: z.string().min(1, 'Please confirm new password'),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    message: 'Passwords must match',
    path: ['password'],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const ResetPassword = () => {
  useDocumentTitle('Choose a new password');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { resetToken } = useParams<{ resetToken: string }>();
  const authenticated = useAppSelector(selectAuthenticated);
  const errorMessage = useAppSelector(selectAuthError);
  const message = useAppSelector(selectAuthMessage);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', passwordConfirm: '' },
  });

  useEffect(() => {
    if (authenticated) {
      navigate('/dashboard');
    }
  }, [authenticated, navigate]);

  useEffect(() => {
    return () => {
      dispatch(clearError());
      dispatch(clearMessage());
    };
  }, [dispatch]);

  const onSubmit = handleSubmit(async (values) => {
    if (!resetToken) return;
    const result = await dispatch(performPasswordReset({ token: resetToken, password: values.password }));
    if (performPasswordReset.fulfilled.match(result)) {
      navigate('/login');
    }
  });

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Choose a new password</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="reset-password">New Password</Label>
              <Input
                id="reset-password"
                type="password"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              {errors.password ? (
                <p className="text-destructive text-sm">{errors.password.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="reset-password-confirm">Confirm New Password</Label>
              <Input
                id="reset-password-confirm"
                type="password"
                aria-invalid={!!errors.passwordConfirm}
                {...register('passwordConfirm')}
              />
              {errors.passwordConfirm ? (
                <p className="text-destructive text-sm">{errors.passwordConfirm.message}</p>
              ) : null}
            </div>

            {errorMessage ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>
                  <strong>Oops!</strong> {errorMessage}
                </AlertDescription>
              </Alert>
            ) : null}
            {message ? (
              <Alert role="status">
                <AlertDescription>
                  <strong>Success!</strong> {message}
                </AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              Change Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
