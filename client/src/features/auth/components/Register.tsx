import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { registerUser } from '../store/thunks';
import { clearError } from '../store/slice';
import { selectAuthError, selectAuthenticated } from '../store/selectors';

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
      navigate('/dashboard');
    }
  }, [authenticated, navigate]);

  const onSubmit = handleSubmit(async (values) => {
    await dispatch(registerUser(values));
  });

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">Create your account</h1>
        <form className="auth-form" onSubmit={onSubmit}>
          {errorMessage ? (
            <div className="auth-alert" role="alert">
              <strong>Error!</strong> {errorMessage}
            </div>
          ) : null}
          <div className="auth-field">
            <label htmlFor="register-first-name">First Name</label>
            <input id="register-first-name" type="text" {...register('firstName')} />
            {errors.firstName ? <div className="error">{errors.firstName.message}</div> : null}
          </div>
          <div className="auth-field">
            <label htmlFor="register-last-name">Last Name</label>
            <input id="register-last-name" type="text" {...register('lastName')} />
            {errors.lastName ? <div className="error">{errors.lastName.message}</div> : null}
          </div>
          <div className="auth-field">
            <label htmlFor="register-email">Email</label>
            <input id="register-email" type="text" {...register('email')} />
            {errors.email ? <div className="error">{errors.email.message}</div> : null}
          </div>
          <div className="auth-field">
            <label htmlFor="register-password">Password</label>
            <input id="register-password" type="password" {...register('password')} />
            {errors.password ? <div className="error">{errors.password.message}</div> : null}
          </div>
          <button className="auth-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Registering...' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
};
