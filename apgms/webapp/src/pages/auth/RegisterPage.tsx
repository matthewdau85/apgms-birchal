import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useAuthStore } from '@/state/authStore';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, status, error } = useAuthStore((state) => ({
    register: state.register,
    status: state.status,
    error: state.error,
  }));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await register({ name, email, password });
    if (useAuthStore.getState().status === 'authenticated') {
      navigate('/');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="register form">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Create operator account</h2>
        <p className="mt-1 text-sm text-slate-500">Provision secure access for new team members.</p>
      </div>
      <label className="block text-sm font-medium text-slate-700">
        Full name
        <Input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Email address
        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Password
        <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      </label>
      {error ? <p className="text-sm text-rose-600" role="alert">{error}</p> : null}
      <Button type="submit" disabled={status === 'loading'} className="w-full" variant="secondary">
        {status === 'loading' ? 'Provisioning…' : 'Register account'}
      </Button>
      <p className="text-center text-sm text-slate-500">
        Already registered?{' '}
        <Link to="/auth/login" className="text-blue-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
};

export default RegisterPage;
