import { Link } from 'react-router-dom';
import { useAppSelector } from '@shared/hooks/redux';
import { selectAuthenticated } from '@features/auth';

export const Footer = () => {
  const authenticated = useAppSelector(selectAuthenticated);
  const year = new Date().getFullYear();

  const links = authenticated ? (
    <>
      <li>
        <Link to="/">Home</Link>
      </li>
      <li>
        <Link to="/dashboard">Dashboard</Link>
      </li>
      <li>
        <Link to="/logout">Logout</Link>
      </li>
    </>
  ) : (
    <>
      <li>
        <Link to="/">Home</Link>
      </li>
      <li>
        <Link to="/login">Login</Link>
      </li>
      <li>
        <Link to="/register">Register</Link>
      </li>
    </>
  );

  return (
    <footer>
      <div className="container">
        <div className="row">
          <div className="col-lg-12">
            <nav>
              <ul className="footer-nav">{links}</ul>
            </nav>
            <p className="copyright">
              © {year}, Your Site. All Rights Reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
