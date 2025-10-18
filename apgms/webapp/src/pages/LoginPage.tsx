import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useAppStore } from '../store/appStore';

export const LoginPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signIn, isAuthenticated, error, isBootstrapping } = useAppStore((state) => ({
    signIn: state.signIn,
    isAuthenticated: state.isAuthenticated,
    error: state.error,
    isBootstrapping: state.isBootstrapping
  }));

  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [formError, setFormError] = useState<string | null>(null);

  if (isAuthenticated()) {
    const redirectTo =
      (location.state as { from?: { pathname?: string } } | undefined)?.from?.pathname ??
      '/onboarding';
    return <Navigate to={redirectTo} replace />;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!credentials.email || !credentials.password) {
      setFormError('Enter both your email address and password');
      return;
    }

    try {
      await signIn(credentials.email, credentials.password);
      navigate('/onboarding', { replace: true });
    } catch (signInError) {
      setFormError(
        signInError instanceof Error ? signInError.message : 'Unable to sign in with those details'
      );
    }
  };

  return (
    <div className="login">
      <form className="login__form" aria-label="Sign in" onSubmit={onSubmit}>
        <h1>Sign in to APGMS</h1>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={credentials.email}
          onChange={(event) => setCredentials((prev) => ({ ...prev, email: event.target.value }))}
          placeholder="finance@organisation.com"
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={credentials.password}
          onChange={(event) =>
            setCredentials((prev) => ({ ...prev, password: event.target.value }))
          }
          placeholder="••••••••"
        />

        {(formError || error) && <p className="form-error">{formError ?? error}</p>}

        <button className="button" type="submit" disabled={isBootstrapping}>
          {isBootstrapping ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
};
