import { Link } from 'react-router-dom';
import { useAppSelector } from '@shared/hooks/redux';
import { selectAuthenticated } from '@features/auth';

interface HeaderProps {
  logo: string;
}

export const Header = ({ logo }: HeaderProps) => {
  const authenticated = useAppSelector(selectAuthenticated);

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
    <nav className="navbar navbar-default navbar-fixed-top">
      <div className="container">
        <div className="navbar-header">
          <Link className="navbar-brand" to="/">
            {logo}
          </Link>
        </div>
        <div className="collapse navbar-collapse">
          <ul className="nav navbar-nav navbar-right">{links}</ul>
        </div>
      </div>
    </nav>
  );
};
