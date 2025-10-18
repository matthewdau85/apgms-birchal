import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useAuthStore } from '@/state/authStore';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, status, error } = useAuthStore((state) => ({
    login: state.login,
    status: state.status,
    error: state.error,
  }));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await login({ email, password });
    if (useAuthStore.getState().status === 'authenticated') {
      navigate('/');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="login form">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Sign in</h2>
        <p className="mt-1 text-sm text-slate-500">Use your APGMS operator credentials.</p>
      </div>
      <label className="block text-sm font-medium text-slate-700">
        Email address
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Password
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error ? <p className="text-sm text-rose-600" role="alert">{error}</p> : null}
      <Button type="submit" disabled={status === 'loading'} className="w-full">
        {status === 'loading' ? 'Signing in…' : 'Sign in'}
      </Button>
      <div className="flex items-center justify-between text-sm text-slate-500">
        <Link to="/auth/forgot-password" className="text-blue-600 hover:underline">
          Forgot password?
        </Link>
        <span>
          No account?{' '}
          <Link to="/auth/register" className="text-blue-600 hover:underline">
            Register
          </Link>
        </span>
      </div>
    </form>
  );
};

export default LoginPage;
