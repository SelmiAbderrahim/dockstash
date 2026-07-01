import { Outlet } from 'react-router-dom';
import { Footer } from './Footer';
import { Header } from './Header';

export const AppLayout = () => (
  <div>
    <Header />
    <div className="container">
      <Outlet />
    </div>
    <Footer />
  </div>
);
