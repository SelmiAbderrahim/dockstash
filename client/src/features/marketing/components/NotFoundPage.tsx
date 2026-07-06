import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { SsrNotFound, SITE_NAME } from '@shared/seo';
import { Button } from '@shared/ui/button';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import { Container, Serif, h1Class, sectionClass } from './shared';

/**
 * Marketing catch-all (`*`). SSR'd with a real HTTP 404 (via SsrNotFound) so
 * unknown public URLs stop soft-404ing. Deliberately no canonical/hreflang —
 * a 404 must not advertise alternates.
 */
export const NotFoundPage = () => {
  const { locale } = useMarketingRoute();
  const href = (path: string) => localeHref(path, locale);

  return (
    <>
      <Helmet titleTemplate={`%s · ${SITE_NAME}`}>
        <title>Page not found</title>
        <meta
          name="description"
          content="This page does not exist. Head back to the Dockstash homepage or browse the Docker backup guides."
        />
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      <SsrNotFound />
      <section className={cn('pattern-dot-grid', sectionClass)}>
        <Container className="text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-muted-foreground">
            404
          </p>
          <h1 className={h1Class}>
            This page <Serif>does not</Serif> exist
          </h1>
          <p className="mx-auto mb-8 max-w-[560px] text-muted-foreground">
            The address may be mistyped, or the page may have moved. Everything
            worth backing up is still here.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link to={href('/')}>
                Back to home
                <ArrowRightIcon className="size-4 rtl:-scale-x-100" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={href('/guides')}>Browse backup guides</Link>
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
};
