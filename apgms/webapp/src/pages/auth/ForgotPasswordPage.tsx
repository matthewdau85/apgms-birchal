import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="forgot password form">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Reset password</h2>
        <p className="mt-1 text-sm text-slate-500">
          Enter your email and we will send reset instructions.
        </p>
      </div>
      <label className="block text-sm font-medium text-slate-700">
        Email address
        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      {submitted ? (
        <p className="text-sm text-emerald-600">
          If an account exists, we have sent recovery instructions to {email}.
        </p>
      ) : null}
      <Button type="submit" className="w-full" variant="secondary">
        Send reset link
      </Button>
      <p className="text-center text-sm text-slate-500">
        Remembered it?{' '}
        <Link to="/auth/login" className="text-blue-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
};

export default ForgotPasswordPage;
