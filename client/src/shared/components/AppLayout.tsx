import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { GuideWidget } from '@features/guide';
import { selectAuthenticated } from '@features/auth';
import { BRAND_NAME } from '@shared/brand';
import { useAppSelector } from '@shared/hooks/redux';
import { SidebarInset, SidebarProvider } from '@shared/ui/sidebar';
import { AppFrameFooter } from './AppFrameFooter';
import { AppSidebar } from './AppSidebar';
import { AppTopbar } from './AppTopbar';
import { Footer } from './Footer';
import { Header } from './Header';

/**
 * App shell (SPEC-01/02/03). Authenticated visitors get the sidebar shell —
 * framed main column, grouped sidebar, topbar, in-frame footer. Anonymous
 * visitors (login/register/verify/reset) keep the lightweight top-nav chrome
 * so the auth journey stays uncluttered.
 *
 * `GuideWidget` mounts exactly once here (shared-layout-system rule) so it
 * never double-mounts under a nested layout.
 */
export const AppLayout = () => {
  const authenticated = useAppSelector(selectAuthenticated);

  useEffect(() => {
    if (authenticated) document.title = BRAND_NAME;
  }, [authenticated]);

  if (authenticated) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppTopbar />
          <div className="flex flex-1 flex-col p-4 sm:p-6">
            <main className="flex-1">
              <Outlet />
            </main>
            <AppFrameFooter />
          </div>
        </SidebarInset>
        <GuideWidget />
      </SidebarProvider>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="container mx-auto w-full flex-1 px-4 py-6">
        <Outlet />
      </main>
      <Footer />
      <GuideWidget />
    </div>
  );
};
