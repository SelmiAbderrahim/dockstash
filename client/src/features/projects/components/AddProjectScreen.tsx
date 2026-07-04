import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, FolderIcon, ContainerIcon, PencilIcon, ArrowLeftIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { useTabParam } from '@shared/hooks/useTabParam';
import { Button } from '@shared/ui/button';
import { Badge } from '@shared/ui/badge';
import { Input } from '@shared/ui/input';
import { Card, CardContent } from '@shared/ui/card';
import { Separator } from '@shared/ui/separator';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Skeleton } from '@shared/ui/skeleton';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@shared/ui/empty';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';
import { listAgentsRequest, type Agent } from '@features/fleet';
import {
  createProject,
  discoverAgent,
  discoverContainers,
  discoverFolders,
  refreshAgent,
  scanProject,
} from '../store/thunks';
import { resetAddFlow } from '../store/slice';
import {
  selectAddError,
  selectAgentContainers,
  selectAgentDiscoveryErrors,
  selectAgentDiscoveryStatus,
  selectAgentDockerAvailable,
  selectAgentFolders,
  selectAgentRefreshStatus,
  selectAgentReported,
  selectAgentSnapshotAt,
  selectContainersStatus,
  selectCreateStatus,
  selectDiscoveredContainers,
  selectDiscoveredFolders,
  selectDockerAvailable,
  selectFoldersStatus,
  selectProjectPaths,
  selectScanStatus,
} from '../store/selectors';
import type { ProjectPlan } from '../types';

const TABS = ['folders', 'docker', 'manual'] as const;
const LOCAL = 'local';
const emptyPlan = (path: string): ProjectPlan => ({
  paths: [path],
  databases: [],
  configs: [],
});

// Local folders lack a plan (server scans on pick); agent folders carry one.
interface DisplayFolder {
  name: string;
  path: string;
  hasCompose: boolean;
  composeFile: string | null;
  plan?: ProjectPlan;
}
interface DisplayContainer {
  project: string;
  workingDir: string | null;
  services: string[];
  addable: boolean;
  standalone: boolean;
  plan?: ProjectPlan | null;
}

export const AddProjectScreen = () => {
  const { t, i18n } = useTranslation('projects');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [tab, setTab] = useTabParam('folders', TABS);

  const localFolders = useAppSelector(selectDiscoveredFolders);
  const foldersStatus = useAppSelector(selectFoldersStatus);
  const localContainers = useAppSelector(selectDiscoveredContainers);
  const containersStatus = useAppSelector(selectContainersStatus);
  const localDockerAvailable = useAppSelector(selectDockerAvailable);
  const agentFolders = useAppSelector(selectAgentFolders);
  const agentContainers = useAppSelector(selectAgentContainers);
  const agentDockerAvailable = useAppSelector(selectAgentDockerAvailable);
  const agentSnapshotAt = useAppSelector(selectAgentSnapshotAt);
  const agentDiscoveryStatus = useAppSelector(selectAgentDiscoveryStatus);
  const agentReported = useAppSelector(selectAgentReported);
  const agentDiscoveryErrors = useAppSelector(selectAgentDiscoveryErrors);
  const agentRefreshStatus = useAppSelector(selectAgentRefreshStatus);
  const scanStatus = useAppSelector(selectScanStatus);
  const createStatus = useAppSelector(selectCreateStatus);
  const addError = useAppSelector(selectAddError);
  const addedPaths = useAppSelector(selectProjectPaths);

  // Review-step state. When `plan` is set the picker gives way to the review
  // form; `path`/`name` carry the chosen source into the create call.
  const [plan, setPlan] = useState<ProjectPlan | null>(null);
  const [path, setPath] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [manualPath, setManualPath] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [target, setTarget] = useState<string>(LOCAL);
  const isAgent = target !== LOCAL;

  // Fleet agents for the target picker; self-gates to Local-only on error/lock.
  useEffect(() => {
    void listAgentsRequest().then(setAgents, () => setAgents([]));
  }, []);

  useEffect(() => {
    if (isAgent) {
      void dispatch(discoverAgent({ agentId: target }));
      return;
    }
    if (tab === 'folders') void dispatch(discoverFolders());
    else if (tab === 'docker') void dispatch(discoverContainers());
  }, [tab, target, isAgent, dispatch]);

  useEffect(() => () => void dispatch(resetAddFlow()), [dispatch]);

  const selectedAgent = isAgent ? (agents.find((a) => a.id === target) ?? null) : null;
  const agentOffline = selectedAgent?.status === 'offline';

  const handleRefreshAgent = async () => {
    await dispatch(refreshAgent({ agentId: target }));
    // The daemon's next heartbeat (within its usual interval) carries the
    // fresh snapshot — give it a moment before re-polling the read endpoint.
    window.setTimeout(() => {
      void dispatch(discoverAgent({ agentId: target }));
    }, 5000);
  };

  const isAdded = (candidate: string | null): boolean =>
    candidate !== null && addedPaths.includes(candidate);

  const toReview = (nextPath: string, nextName: string, nextPlan: ProjectPlan) => {
    setPath(nextPath);
    setName(nextName);
    setPlan(nextPlan);
  };

  // Compose sources on the LOCAL host scan for a plan (the server reads its own
  // fs); plain local folders skip straight to a files-only plan.
  const pickComposeSource = async (nextPath: string, nextName: string) => {
    setPath(nextPath);
    setName(nextName);
    const res = await dispatch(scanProject({ path: nextPath }));
    if (scanProject.fulfilled.match(res)) {
      setPlan(res.payload);
    }
  };

  // A folder carrying a plan (agent) goes straight to review; otherwise the
  // local scan/files-only path applies.
  const pickFolder = (f: DisplayFolder) => {
    if (f.plan) return toReview(f.path, f.name, f.plan);
    if (f.hasCompose) return void pickComposeSource(f.path, f.name);
    return toReview(f.path, f.name, emptyPlan(f.path));
  };

  const pickContainer = (c: DisplayContainer) => {
    if (c.plan) return toReview(c.workingDir as string, c.project, c.plan);
    return void pickComposeSource(c.workingDir as string, c.project);
  };

  const submit = async (finalPlan: ProjectPlan) => {
    const res = await dispatch(
      createProject({
        name: name.trim(),
        path,
        repoPassword: password,
        plan: finalPlan,
        agentId: isAgent ? target : null,
      }),
    );
    if (createProject.fulfilled.match(res)) {
      navigate('/projects');
    }
  };

  const backToPicker = () => {
    setPlan(null);
    dispatch(resetAddFlow());
  };

  const scanning = scanStatus === 'loading';

  if (plan) {
    return (
      <ReviewStep
        initialPlan={plan}
        path={path}
        name={name}
        setName={setName}
        password={password}
        setPassword={setPassword}
        creating={createStatus === 'loading'}
        error={addError}
        onSubmit={submit}
        onBack={backToPicker}
      />
    );
  }

  const folders: DisplayFolder[] = isAgent ? agentFolders : localFolders;
  const containers: DisplayContainer[] = isAgent ? agentContainers : localContainers;
  const dockerAvailable = isAgent ? agentDockerAvailable : localDockerAvailable;
  const foldersLoading = (isAgent ? agentDiscoveryStatus : foldersStatus) === 'loading';
  const foldersReady = (isAgent ? agentDiscoveryStatus : foldersStatus) === 'succeeded';
  const dockerLoading = (isAgent ? agentDiscoveryStatus : containersStatus) === 'loading';
  const dockerReady = (isAgent ? agentDiscoveryStatus : containersStatus) === 'succeeded';

  return (
    <section
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8"
      aria-labelledby="add-heading"
    >
      <header className="flex flex-col gap-1">
        <h1 id="add-heading" className="text-2xl font-semibold tracking-tight">
          {t('add.title')}
        </h1>
        <p className="text-muted-foreground text-sm">{t('add.lede')}</p>
      </header>

      <div className="flex flex-col gap-2" data-tour="add-target">
        <label className="text-sm font-medium" htmlFor="target-host">
          {t('add.target.label')}
        </label>
        <select
          id="target-host"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="border-input bg-transparent focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full max-w-sm rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
        >
          <option value={LOCAL}>{t('add.target.local')}</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.host})
              {a.status === 'offline' ? ` — ${t('add.agent.offlineBadge')}` : ''}
            </option>
          ))}
        </select>
        {isAgent && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-muted-foreground text-xs">
              {agentSnapshotAt
                ? t('add.target.snapshotAt', {
                    at: new Date(agentSnapshotAt).toLocaleString(i18n.language),
                  })
                : t('add.target.noSnapshot')}
            </p>
            {agentOffline && (
              <Badge variant="destructive">{t('add.agent.offlineBadge')}</Badge>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs"
              disabled={agentRefreshStatus === 'loading'}
              onClick={() => void handleRefreshAgent()}
            >
              {agentRefreshStatus === 'loading' && (
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              )}
              {agentRefreshStatus === 'loading'
                ? t('add.agent.refreshing')
                : t('add.agent.refresh')}
            </Button>
          </div>
        )}
        {isAgent && !agentReported && (
          <Alert data-testid="agent-not-reported">
            <AlertDescription>
              {t('add.agent.notReportedHint')}{' '}
              <Link to="/fleet" className="font-medium underline-offset-4 hover:underline">
                {t('add.agent.fleetLink')}
              </Link>
            </AlertDescription>
          </Alert>
        )}
        {isAgent && agentReported && agentDiscoveryErrors.length > 0 && (
          <Alert variant="destructive" data-testid="agent-discovery-errors">
            <AlertDescription>
              <p className="font-medium">{t('add.agent.errorsTitle')}</p>
              <ul className="list-disc ps-4">
                {agentDiscoveryErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {scanning && (
        <p
          role="status"
          aria-live="polite"
          className="text-muted-foreground inline-flex items-center gap-2 text-sm"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {t('add.scanning')}
        </p>
      )}

      {!scanning && addError && (
        <Alert variant="destructive">
          <AlertDescription>{addError}</AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <TabsList aria-label={t('add.tabs.aria')} data-tour="add-source-tabs">
          <TabsTrigger value="folders" disabled={agentOffline}>
            <FolderIcon className="size-4" aria-hidden="true" /> {t('add.tabs.folders')}
          </TabsTrigger>
          <TabsTrigger value="docker" disabled={agentOffline}>
            <ContainerIcon className="size-4" aria-hidden="true" /> {t('add.tabs.docker')}
          </TabsTrigger>
          <TabsTrigger value="manual" disabled={isAgent}>
            <PencilIcon className="size-4" aria-hidden="true" /> {t('add.tabs.manual')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="folders" className="flex flex-col gap-3">
          {foldersLoading && <Skeleton className="h-24 w-full" />}
          {foldersReady && folders.length === 0 && (
            <Empty data-testid="folders-empty">
              <EmptyHeader>
                <EmptyTitle>{t('add.folders.emptyTitle')}</EmptyTitle>
                <EmptyDescription>
                  {t(isAgent ? 'add.folders.emptyHintAgent' : 'add.folders.emptyHint')}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {folders.map((f) => {
            const added = isAdded(f.path);
            return (
              <Card key={f.path}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{f.name}</span>
                    <span className="text-muted-foreground font-mono text-xs break-all">
                      {f.path}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={f.hasCompose ? 'default' : 'secondary'}>
                        {f.hasCompose ? t('add.badges.compose') : t('add.badges.plain')}
                      </Badge>
                      {added && <Badge variant="outline">{t('add.badges.added')}</Badge>}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={added || scanning}
                    onClick={() => pickFolder(f)}
                  >
                    {t('add.select')}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="docker" className="flex flex-col gap-3">
          {dockerLoading && <Skeleton className="h-24 w-full" />}
          {dockerReady && !dockerAvailable && (
            <Empty data-testid="docker-unavailable">
              <EmptyHeader>
                <EmptyTitle>{t('add.docker.unavailableTitle')}</EmptyTitle>
                <EmptyDescription>
                  {t(isAgent ? 'add.docker.unavailableHintAgent' : 'add.docker.unavailableHint')}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {dockerReady && dockerAvailable && containers.length === 0 && (
            <Empty data-testid="docker-empty">
              <EmptyHeader>
                <EmptyTitle>{t('add.docker.emptyTitle')}</EmptyTitle>
                <EmptyDescription>{t('add.docker.emptyHint')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {dockerAvailable &&
            containers.map((c) => {
              const added = isAdded(c.workingDir);
              const disabled = !c.addable || added || scanning;
              return (
                <Card key={c.project}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{c.project}</span>
                      {c.workingDir && (
                        <span className="text-muted-foreground font-mono text-xs break-all">
                          {c.workingDir}
                        </span>
                      )}
                      {c.services.length > 0 && (
                        <span className="text-muted-foreground text-xs">
                          {t('add.services')}: {c.services.join(', ')}
                        </span>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {c.standalone && (
                          <Badge variant="secondary">{t('add.badges.standalone')}</Badge>
                        )}
                        {!c.addable && !c.standalone && (
                          <Badge variant="secondary">{t('add.badges.notAddable')}</Badge>
                        )}
                        {added && <Badge variant="outline">{t('add.badges.added')}</Badge>}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => pickContainer(c)}
                    >
                      {t('add.select')}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
        </TabsContent>

        <TabsContent value="manual">
          <Card>
            <CardContent className="py-4">
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void pickComposeSource(manualPath.trim(), basename(manualPath.trim()));
                }}
              >
                <label className="flex flex-col gap-2 text-sm" htmlFor="manual-path">
                  <span className="font-medium">{t('add.manual.label')}</span>
                  <Input
                    id="manual-path"
                    value={manualPath}
                    onChange={(e) => setManualPath(e.target.value)}
                    placeholder="/var/www/my-app"
                    className="font-mono"
                  />
                </label>
                <Button type="submit" disabled={manualPath.trim().length === 0 || scanning}>
                  {t('add.manual.scan')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Button asChild variant="link" size="sm" className="h-auto self-start p-0">
        <Link to="/projects">
          <ArrowLeftIcon className="size-4" aria-hidden="true" /> {t('add.cancel')}
        </Link>
      </Button>
    </section>
  );
};

function basename(p: string): string {
  const parts = p.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? p;
}

interface ReviewProps {
  initialPlan: ProjectPlan;
  path: string;
  name: string;
  setName: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  creating: boolean;
  error: string | null;
  onSubmit: (plan: ProjectPlan) => void;
  onBack: () => void;
}

const ReviewStep = ({
  initialPlan,
  path,
  name,
  setName,
  password,
  setPassword,
  creating,
  error,
  onSubmit,
  onBack,
}: ReviewProps) => {
  const { t } = useTranslation('projects');
  const [plan, setPlan] = useState<ProjectPlan>(initialPlan);
  const canSubmit = name.trim().length > 0 && password.length >= 8 && !creating;

  const toggleDb = (idx: number) =>
    setPlan((p) => ({
      ...p,
      databases: p.databases.map((d, i) => (i === idx ? { ...d, enabled: !d.enabled } : d)),
    }));
  const toggleConfig = (cfg: string) =>
    setPlan((p) => ({
      ...p,
      configs: p.configs.includes(cfg)
        ? p.configs.filter((x) => x !== cfg)
        : [...p.configs, cfg],
    }));

  return (
    <section
      className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8"
      aria-labelledby="review-heading"
    >
      <header className="flex flex-col gap-1">
        <h1 id="review-heading" className="text-2xl font-semibold tracking-tight">
          {t('add.review.title')}
        </h1>
        <p className="text-muted-foreground font-mono text-xs break-all">{path}</p>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="flex flex-col gap-6 py-6">
          <form
            className="flex flex-col gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit(plan);
            }}
          >
            <label className="flex flex-col gap-2 text-sm" htmlFor="project-name">
              <span className="font-medium">{t('add.review.nameLabel')}</span>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>

            <div className="flex flex-col gap-2 text-sm">
              <label className="font-medium" htmlFor="repo-password">
                {t('add.review.passwordLabel')}
              </label>
              <Input
                id="repo-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="password-hint"
              />
              <span id="password-hint" className="text-muted-foreground text-xs">
                {t('add.review.passwordHint')}
              </span>
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t('add.review.files')}</span>
              {plan.paths.map((p) => (
                <span key={p} className="text-muted-foreground font-mono text-xs break-all">
                  {p}
                </span>
              ))}
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">{t('add.review.databases')}</legend>
              {plan.databases.length === 0 && (
                <p className="text-muted-foreground text-sm">{t('add.review.none')}</p>
              )}
              {plan.databases.map((db, idx) => (
                <label key={`${db.service}-${idx}`} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-primary size-4"
                    checked={db.enabled}
                    onChange={() => toggleDb(idx)}
                    aria-label={`${db.service} (${db.type})`}
                  />
                  <span>
                    {db.service} <em className="text-muted-foreground">({db.type})</em>
                  </span>
                </label>
              ))}
            </fieldset>

            {initialPlan.configs.length > 0 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">{t('add.review.configs')}</legend>
                {initialPlan.configs.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-primary size-4"
                      checked={plan.configs.includes(c)}
                      onChange={() => toggleConfig(c)}
                      aria-label={c}
                    />
                    <span className="font-mono text-xs break-all">{c}</span>
                  </label>
                ))}
              </fieldset>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={!canSubmit}>
                {creating && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {creating ? t('add.review.creating') : t('add.review.create')}
              </Button>
              <Button type="button" variant="outline" onClick={onBack}>
                {t('add.review.back')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
};
