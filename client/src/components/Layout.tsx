import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import './Layout.css';

export default function Layout() {
  const { user, logout, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="layout">
      <header className="header">
        <div className="container header-content">
          <Link to={isAuthenticated ? '/this-week' : '/'} className="logo">
            Runny
          </Link>
          <nav className="nav">
            {isAuthenticated ? (
              <>
                <Link
                  to="/this-week"
                  className={`nav-link ${isActive('/this-week') ? 'active' : ''}`}
                >
                  This Week
                </Link>
                <Link
                  to="/plan"
                  className={`nav-link ${isActive('/plan') ? 'active' : ''}`}
                >
                  Full Plan
                </Link>
                <Link
                  to="/progress"
                  className={`nav-link ${isActive('/progress') ? 'active' : ''}`}
                >
                  Progress
                </Link>
                <Link
                  to="/community"
                  className={`nav-link ${isActive('/community') ? 'active' : ''}`}
                >
                  Community
                </Link>
                <div className="nav-divider" />
                <Link
                  to="/profile"
                  className={`nav-link ${isActive('/profile') ? 'active' : ''}`}
                >
                  {user?.name || 'Profile'}
                </Link>
                <button onClick={handleLogout} className="btn btn-outline btn-small">
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link">
                  Log in
                </Link>
                <Link to="/signup" className="btn btn-primary btn-small">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container">
          <p className="text-light text-center">
            Runny - Your Adaptive Running Training Partner
          </p>
        </div>
      </footer>
    </div>
  );
}
