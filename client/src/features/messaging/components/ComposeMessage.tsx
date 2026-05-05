import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { fetchRecipients, startConversation } from '../store/thunks';
import { selectMessagingError, selectMessagingMessage, selectRecipients } from '../store/selectors';

const composeSchema = z.object({
  recipient: z.string().min(1, 'Please select a recipient'),
  composedMessage: z.string().min(1, 'Please enter a message'),
});

type ComposeValues = z.infer<typeof composeSchema>;

export const ComposeMessage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const recipients = useAppSelector(selectRecipients);
  const errorMessage = useAppSelector(selectMessagingError);
  const message = useAppSelector(selectMessagingMessage);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ComposeValues>({
    resolver: zodResolver(composeSchema),
    defaultValues: { recipient: '', composedMessage: '' },
  });

  useEffect(() => {
    void dispatch(fetchRecipients());
  }, [dispatch]);

  const onSubmit = handleSubmit(async (values) => {
    const result = await dispatch(
      startConversation({ recipient: values.recipient, composedMessage: values.composedMessage }),
    );
    if (startConversation.fulfilled.match(result)) {
      reset();
      navigate(`/dashboard/conversation/view/${result.payload.conversationId}`);
    }
  });

  return (
    <form onSubmit={onSubmit}>
      <h2>Start New Conversation</h2>
      <select {...register('recipient')}>
        <option value="" />
        {recipients.map((data) => (
          <option key={data._id} value={data._id}>
            {data.profile.firstName} {data.profile.lastName}
          </option>
        ))}
      </select>
      {errors.recipient ? <div className="error">{errors.recipient.message}</div> : null}

      <label>Enter your message below</label>
      {errorMessage ? (
        <div role="alert">
          <strong>Oops!</strong> {errorMessage}
        </div>
      ) : null}
      {message ? (
        <div>
          <strong>Success!</strong> {message}
        </div>
      ) : null}
      <input type="text" placeholder="Type here to chat..." {...register('composedMessage')} />
      {errors.composedMessage ? (
        <div className="error">{errors.composedMessage.message}</div>
      ) : null}
      <button type="submit" disabled={isSubmitting}>
        Send
      </button>
    </form>
  );
};
