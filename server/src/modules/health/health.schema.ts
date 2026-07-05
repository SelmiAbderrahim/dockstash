import { z } from 'zod';

/** `GET /api/health/alerts?unread=true` — filter to unread rows only. */
export const listAlertsQuerySchema = z.object({
  unread: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

/** `POST /api/health/alerts/read` — ids omitted/empty = mark all unread. */
export const markAlertsReadSchema = z.object({
  ids: z.array(z.string().regex(/^[a-f0-9]{24}$/i, 'invalid alert id')).optional(),
});

export type ListAlertsQuery = z.infer<typeof listAlertsQuerySchema>;
export type MarkAlertsReadInput = z.infer<typeof markAlertsReadSchema>;
