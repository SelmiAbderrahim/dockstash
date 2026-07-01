import { Outlet } from 'react-router-dom';
import { Footer } from './Footer';
import { Header } from './Header';

export const AppLayout = () => (
  <div className="flex min-h-dvh flex-col">
    <Header />
    <main className="container mx-auto w-full flex-1 px-4 py-6">
      <Outlet />
    </main>
    <Footer />
  </div>
);
