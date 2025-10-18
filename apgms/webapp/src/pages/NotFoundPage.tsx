import { Link } from 'react-router-dom';

export const NotFoundPage = () => (
  <div className="page page--centered">
    <h1>Page not found</h1>
    <p>The page you were looking for doesn\'t exist.</p>
    <Link className="button" to="/onboarding">
      Go back home
    </Link>
  </div>
);
