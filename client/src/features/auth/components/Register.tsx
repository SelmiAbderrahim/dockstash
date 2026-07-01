import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Alert, AlertDescription } from '@shared/ui/alert';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@shared/ui/card';
import { registerUser } from '../store/thunks';
import { clearError } from '../store/slice';
import {
  selectAuthError,
  selectAuthenticated,
  selectEmailVerified,
} from '../store/selectors';

const registerSchema = z.object({
  firstName: z.string().min(1, 'Please enter a first name'),
  lastName: z.string().min(1, 'Please enter a last name'),
  email: z.string().min(1, 'Please enter an email'),
  password: z.string().min(1, 'Please enter a password'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export const Register = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const errorMessage = useAppSelector(selectAuthError);
  const authenticated = useAppSelector(selectAuthenticated);
  const emailVerified = useAppSelector(selectEmailVerified);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
  });

  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  useEffect(() => {
    if (authenticated) {
      // Unverified accounts must confirm their email before the product shell.
      navigate(emailVerified ? '/dashboard' : '/verify-email');
    }
  }, [authenticated, emailVerified, navigate]);

  const onSubmit = handleSubmit(async (values) => {
    await dispatch(registerUser(values));
  });

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Create your account</CardTitle>
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="register-first-name">First Name</Label>
                <Input
                  id="register-first-name"
                  type="text"
                  aria-invalid={!!errors.firstName}
                  {...register('firstName')}
                />
                {errors.firstName ? (
                  <p className="text-destructive text-sm">{errors.firstName.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="register-last-name">Last Name</Label>
                <Input
                  id="register-last-name"
                  type="text"
                  aria-invalid={!!errors.lastName}
                  {...register('lastName')}
                />
                {errors.lastName ? (
                  <p className="text-destructive text-sm">{errors.lastName.message}</p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="register-email">Email</Label>
              <Input
                id="register-email"
                type="text"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email ? (
                <p className="text-destructive text-sm">{errors.email.message}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="register-password">Password</Label>
              <Input
                id="register-password"
                type="password"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              {errors.password ? (
                <p className="text-destructive text-sm">{errors.password.message}</p>
              ) : null}
            </div>
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Registering...' : 'Register'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              By registering you agree to our{' '}
              <Link to="/terms" className="underline underline-offset-4 hover:text-foreground">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">
                Privacy Policy
              </Link>
              .
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
