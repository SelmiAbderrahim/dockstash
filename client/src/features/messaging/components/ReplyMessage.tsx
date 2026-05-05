import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { sendReply } from '../store/thunks';
import { selectMessagingError, selectMessagingMessage } from '../store/selectors';
import { getSocket } from '../socket';

interface ReplyMessageProps {
  replyTo: string;
}

const replySchema = z.object({
  composedMessage: z.string().min(1, 'Please enter a message'),
});

type ReplyValues = z.infer<typeof replySchema>;

export const ReplyMessage = ({ replyTo }: ReplyMessageProps) => {
  const dispatch = useAppDispatch();
  const errorMessage = useAppSelector(selectMessagingError);
  const message = useAppSelector(selectMessagingMessage);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<ReplyValues>({
    resolver: zodResolver(replySchema),
    defaultValues: { composedMessage: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    const result = await dispatch(sendReply({ replyTo, composedMessage: values.composedMessage }));
    if (sendReply.fulfilled.match(result)) {
      reset({ composedMessage: '' });
      getSocket().emit('new message', replyTo);
    }
  });

  return (
    <form onSubmit={onSubmit}>
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
      <input
        type="text"
        autoComplete="off"
        placeholder="Type here to chat..."
        {...register('composedMessage')}
      />
      <button type="submit" disabled={isSubmitting}>
        Send
      </button>
    </form>
  );
};
