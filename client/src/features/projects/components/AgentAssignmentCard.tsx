import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@shared/hooks/redux';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@shared/ui/select';
import { listAgentsRequest, type Agent } from '@features/fleet';
import { assignProjectAgent } from '../store/thunks';
import type { Project } from '../types';

/** Radix Select disallows empty-string values; map the sentinel to `null`. */
const LOCAL_VALUE = 'local';

interface Props {
  project: Project;
}

/**
 * "Runs on" selector — assign a project to a fleet agent or the local server.
 * Self-gating: renders nothing when the user has no agents or the fleet
 * endpoint fails. The Fleet screen is where agents are registered.
 */
export const AgentAssignmentCard = ({ project }: Props) => {
  const { t } = useTranslation('projectDetail');
  const dispatch = useAppDispatch();
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<'saved' | 'error' | null>(null);

  useEffect(() => {
    let active = true;
    listAgentsRequest()
      .then((list) => {
        if (active) setAgents(list);
      })
      .catch(() => {
        // No agents / locked / offline — self-gate by staying hidden.
        if (active) setAgents([]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!agents || agents.length === 0) return null;

  const value = project.agentId ?? LOCAL_VALUE;

  const onChange = (next: string) => {
    const agentId = next === LOCAL_VALUE ? null : next;
    setSaving(true);
    setFeedback(null);
    void dispatch(assignProjectAgent({ projectId: project.id, agentId }))
      .unwrap()
      .then(() => setFeedback('saved'))
      .catch(() => setFeedback('error'))
      .finally(() => setSaving(false));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('agent.title')}</CardTitle>
        <CardDescription>{t('agent.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-start">
        <Select value={value} onValueChange={onChange} disabled={saving}>
          <SelectTrigger aria-label={t('agent.selectAria')} className="w-full sm:w-80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={LOCAL_VALUE}>{t('agent.local')}</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name} — {agent.host}
                {agent.status === 'offline' ? ` (${t('agent.offline')})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {saving && <span className="text-sm text-muted-foreground">{t('agent.saving')}</span>}
        {!saving && feedback === 'saved' && (
          <span role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {t('agent.saved')}
          </span>
        )}
        {!saving && feedback === 'error' && (
          <span role="alert" className="text-sm font-medium text-destructive">
            {t('agent.error')}
          </span>
        )}
      </CardContent>
    </Card>
  );
};
