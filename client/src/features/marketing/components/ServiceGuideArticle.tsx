import { Link } from 'react-router-dom';
import { Seo, schema } from '@shared/seo';
import { Button } from '@shared/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@shared/ui/table';
import {
  getServiceGuide,
  getUseCase,
  guideIntro,
  consistencyNote,
  type GuideCopyBundle,
  type ServiceGuideCopy,
} from '@features/marketing/content';
import type { ServiceGuide } from '../types';
import { localeHref } from '../useMarketingRoute';
import {
  Breadcrumbs,
  CodeBlock,
  Container,
  Eyebrow,
  FaqSection,
  LastUpdated,
  LinkCard,
  answerClass,
  h1Class,
  h2Class,
  sectionClass,
  useMarketingT,
} from './shared';
import { TroubleshootingList, WalkthroughList } from './guide-shared';
import { Reveal } from '../useReveal';

const listClass = 'list-disc space-y-1.5 ps-5 text-muted-foreground';

export const ServiceGuideArticle = ({
  guide,
  copy,
  bundle,
}: {
  guide: ServiceGuide;
  copy: ServiceGuideCopy;
  bundle: GuideCopyBundle;
}) => {
  const { t, locale } = useMarketingT();
  const href = (path: string) => localeHref(path, locale);
  const name = guide.serviceName;
  const basePath = `/guides/backup-${guide.slug}-docker`;

  const howToSteps = guide.walkthrough.flatMap((step) => {
    const stepCopy = copy.walkthrough[step.id];
    /* v8 ignore next -- guide-copy tests guarantee copy for every shipped step id */
    if (!stepCopy) return [];
    return [
      {
        name: stepCopy.title,
        text: step.cmd ? `${stepCopy.body} ${step.cmd}` : stepCopy.body,
      },
    ];
  });

  const lastModified = schema.monthToIso(guide.lastReviewed);

  const jsonLd = schema.graph(
    ...schema.siteEntities(),
    schema.article({
      headline: t('guides.article.howToName', { name }),
      description: t('guides.article.seoDescription', { name }),
      path: localeHref(basePath, locale),
      dateModified: lastModified,
      inLanguage: locale,
    }),
    schema.howTo(t('guides.article.howToName', { name }), howToSteps),
    schema.breadcrumbList([
      { name: t('shared.home'), path: localeHref('/', locale) },
      { name: t('guides.breadcrumb'), path: localeHref('/guides', locale) },
      { name, path: localeHref(basePath, locale) },
    ]),
    schema.faqPage(copy.faq),
  );

  return (
    <>
      <Seo
        title={t('guides.article.seoTitle', { name })}
        description={t('guides.article.seoDescription', { name })}
        basePath={basePath}
        locale={locale}
        type="article"
        dateModified={lastModified}
        jsonLd={jsonLd}
      />

      <Container>
        <Breadcrumbs
          crumbs={[
            { label: t('shared.home'), basePath: '/' },
            { label: t('guides.breadcrumb'), basePath: '/guides' },
            { label: name },
          ]}
          locale={locale}
        />
      </Container>

      <section className={sectionClass}>
        <Container>
          <h1 className={h1Class}>{t('guides.article.headline', { name })}</h1>
          <p className={answerClass}>{guideIntro(guide, bundle)}</p>
        </Container>
      </section>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <Eyebrow>{t('guides.article.detectionEyebrow')}</Eyebrow>
          <h2 className={h2Class}>{t('guides.article.detectionTitle')}</h2>
          <Table className="border">
            <TableBody>
              <TableRow>
                <TableHead
                  scope="row"
                  className="w-1/3 whitespace-normal text-start align-top font-medium"
                >
                  {t('guides.article.envKeys')}
                </TableHead>
                <TableCell className="whitespace-normal align-top">
                  {guide.envKeysDetected.join(', ')}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableHead
                  scope="row"
                  className="w-1/3 whitespace-normal text-start align-top font-medium"
                >
                  {t('guides.article.defaultPort')}
                </TableHead>
                <TableCell className="whitespace-normal align-top">
                  {guide.defaultPort || '—'}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableHead
                  scope="row"
                  className="w-1/3 whitespace-normal text-start align-top font-medium"
                >
                  {t('guides.article.livePaths')}
                </TableHead>
                <TableCell className="whitespace-normal align-top">
                  {guide.liveDataPaths.join(', ')}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableHead
                  scope="row"
                  className="w-1/3 whitespace-normal text-start align-top font-medium"
                >
                  {t('guides.article.images')}
                </TableHead>
                <TableCell className="whitespace-normal align-top">
                  {guide.dockerImages.join(', ')}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Container>
      </Reveal>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <Eyebrow>{t('guides.article.walkthroughEyebrow')}</Eyebrow>
          <h2 className={h2Class}>{t('guides.article.walkthroughTitle', { name })}</h2>
          <WalkthroughList steps={guide.walkthrough} copy={copy.walkthrough} />
        </Container>
      </Reveal>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <Eyebrow>{t('guides.article.commandsEyebrow')}</Eyebrow>
          <h2 className={h2Class}>{t('guides.article.dumpTitle')}</h2>
          <CodeBlock>{guide.dumpCmd}</CodeBlock>
          <h2 className={`${h2Class} mt-8`}>{t('guides.article.restoreTitle')}</h2>
          <CodeBlock>{guide.restoreCmd}</CodeBlock>
          <p className="mt-4 text-muted-foreground">
            {consistencyNote(guide, bundle)}
          </p>
        </Container>
      </Reveal>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <Eyebrow>{t('guides.article.restoreVerifyEyebrow')}</Eyebrow>
          <h2 className={h2Class}>
            {t('guides.article.restoreVerifyTitle', { name })}
          </h2>
          <p className={`${answerClass} mb-10`}>{copy.restoreVerify.intro}</p>
          <WalkthroughList
            steps={guide.restoreVerify}
            copy={copy.restoreVerify.steps}
          />
        </Container>
      </Reveal>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <Eyebrow>{t('guides.article.gotchasEyebrow')}</Eyebrow>
          <h2 className={h2Class}>{t('guides.article.gotchasTitle')}</h2>
          <ul className={listClass}>
            {copy.gotchas.map((gotcha) => (
              <li key={gotcha}>{gotcha}</li>
            ))}
          </ul>
        </Container>
      </Reveal>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <Eyebrow>{t('guides.article.troubleshootingEyebrow')}</Eyebrow>
          <h2 className={h2Class}>
            {t('guides.article.troubleshootingTitle', { name })}
          </h2>
          <TroubleshootingList
            items={copy.troubleshooting}
            labels={{
              symptom: t('guides.article.symptom'),
              cause: t('guides.article.cause'),
              fix: t('guides.article.fix'),
            }}
          />
        </Container>
      </Reveal>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <h2 className={h2Class}>{t('guides.article.ctaTitle')}</h2>
          <p className="max-w-prose text-muted-foreground">
            {t('guides.article.ctaBody')}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/register">{t('guides.article.startFree')}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={href('/guides')}>{t('guides.article.allGuides')}</Link>
            </Button>
          </div>
          <LastUpdated iso={guide.lastReviewed} />
        </Container>
      </Reveal>

      {/* v8 ignore next 2 -- shipped guides always carry related content; the false arm is unreachable */}
      {(guide.relatedServices.length > 0 ||
        guide.relatedUseCases.length > 0) && (
        <Reveal as="section" className={sectionClass}>
          <Container>
            <h2 className={h2Class}>{t('guides.article.relatedTitle')}</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {guide.relatedServices.map((related) => {
                const relatedGuide = getServiceGuide(related);
                /* v8 ignore next -- every shipped relatedService slug resolves */
                if (!relatedGuide) return null;
                return (
                  <LinkCard
                    key={`svc-${related}`}
                    to={href(`/guides/backup-${related}-docker`)}
                    title={relatedGuide.serviceName}
                    description={t('guides.hub.cardBackup', {
                      name: relatedGuide.serviceName,
                    })}
                  />
                );
              })}
              {guide.relatedUseCases.map((related) => {
                const relatedApp = getUseCase(related);
                /* v8 ignore next -- every shipped relatedUseCase slug resolves */
                if (!relatedApp) return null;
                return (
                  <LinkCard
                    key={`app-${related}`}
                    to={href(`/backup/${related}-docker`)}
                    title={relatedApp.appName}
                    description={relatedApp.category}
                  />
                );
              })}
            </div>
          </Container>
        </Reveal>
      )}

      <FaqSection faqs={copy.faq} />
    </>
  );
};
