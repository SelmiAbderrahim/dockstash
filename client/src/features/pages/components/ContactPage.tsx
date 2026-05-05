import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { clearStatus } from '../store/slice';
import { selectPagesError, selectPagesMessage } from '../store/selectors';
import { sendContactForm } from '../store/thunks';

const contactSchema = z.object({
  firstName: z.string().min(1, 'Please enter your first name'),
  lastName: z.string().min(1, 'Please enter your last name'),
  emailAddress: z.string().min(1, 'Please enter your email'),
  subject: z.string().min(1, 'Please enter a subject'),
  message: z.string().min(1, 'Please enter a message'),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export const ContactPage = () => {
  const dispatch = useAppDispatch();
  const errorMessage = useAppSelector(selectPagesError);
  const successMessage = useAppSelector(selectPagesMessage);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { firstName: '', lastName: '', emailAddress: '', subject: '', message: '' },
  });

  useEffect(() => {
    return () => {
      dispatch(clearStatus());
    };
  }, [dispatch]);

  const onSubmit = handleSubmit(async (values) => {
    const fullName = `${values.firstName} ${values.lastName}`.trim();
    const composed = values.subject ? `${values.subject}\n\n${values.message}` : values.message;
    await dispatch(
      sendContactForm({
        name: fullName,
        emailAddress: values.emailAddress,
        message: composed,
      }),
    );
  });

  return (
    <form onSubmit={onSubmit}>
      {successMessage ? (
        <div>
          <strong>Success!</strong> {successMessage}
        </div>
      ) : null}
      <div>
        <label htmlFor="contact-first-name">First Name</label>
        <input id="contact-first-name" {...register('firstName')} />
        {errors.firstName ? <div className="error">{errors.firstName.message}</div> : null}
      </div>
      <div>
        <label htmlFor="contact-last-name">Last Name</label>
        <input id="contact-last-name" {...register('lastName')} />
        {errors.lastName ? <div className="error">{errors.lastName.message}</div> : null}
      </div>
      <div>
        <label htmlFor="contact-email">Email Address</label>
        <input id="contact-email" {...register('emailAddress')} />
        {errors.emailAddress ? <div className="error">{errors.emailAddress.message}</div> : null}
      </div>
      <div>
        <label htmlFor="contact-subject">Subject</label>
        <input id="contact-subject" {...register('subject')} />
        {errors.subject ? <div className="error">{errors.subject.message}</div> : null}
      </div>
      <div>
        <label htmlFor="contact-message">Message</label>
        <textarea id="contact-message" {...register('message')} />
        {errors.message ? <div className="error">{errors.message.message}</div> : null}
      </div>
      {errorMessage ? (
        <div role="alert">
          <strong>Oops!</strong> {errorMessage}
        </div>
      ) : null}
      <button type="submit" disabled={isSubmitting}>
        Send
      </button>
    </form>
  );
};
