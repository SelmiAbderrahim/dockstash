import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { PageMeta } from '@shared/seo';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@shared/ui/card';
import { requestPasswordReset } from '../store/thunks';
import { clearError, clearMessage } from '../store/slice';
import { selectAuthError, selectAuthMessage, selectAuthenticated } from '../store/selectors';

const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Please enter an email'),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const ForgotPassword = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const authenticated = useAppSelector(selectAuthenticated);
  const errorMessage = useAppSelector(selectAuthError);
  const message = useAppSelector(selectAuthMessage);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
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
    await dispatch(requestPasswordReset({ email: values.email }));
  });

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-8">
      <PageMeta
        title="Reset your password"
        description="Request a password reset link for your Dockstash account. We will email you instructions to choose a new password."
      />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Reset your password</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            {errorMessage ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>
                  <strong>Error!</strong> {errorMessage}
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="text"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email ? (
                <p className="text-destructive text-sm">{errors.email.message}</p>
              ) : null}
            </div>
            <Button type="submit" disabled={isSubmitting} className="w-full">
              Reset Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
