import React, { useEffect, useState } from 'react';
import { Wallet, ArrowRight, Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getSetupStatus, login, setToken } from '../api/client';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { hasWorkspace, persistenceIssue } = await getSetupStatus() as any;
        if (persistenceIssue) setErr(persistenceIssue);
        if (!cancelled && !hasWorkspace) navigate('/signup', { replace: true });
      } catch {
        if (!cancelled) setErr('Cannot reach server. Is npm run dev running?');
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { token } = await login(email.trim(), password);
      setToken(token);
      navigate('/dashboard', { replace: true });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <p className="text-on-surface-variant font-medium">Checking workspace…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface">
      <div className="w-full max-w-[1200px] grid lg:grid-cols-2 bg-surface-container-low rounded-xl overflow-hidden shadow-2xl shadow-on-surface/5">
        <div className="hidden lg:flex flex-col justify-between p-12 primary-gradient text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <Wallet className="text-primary-container w-6 h-6" />
              </div>
              <span className="text-2xl font-black tracking-tight">Kolet Pay</span>
            </div>
          </div>

          <div className="relative z-10 max-w-md">
            <h1 className="text-5xl font-extrabold leading-tight mb-6 tracking-tight">
              Sovereign control over your business capital.
            </h1>
            <p className="text-lg text-blue-200 font-medium leading-relaxed">
              Sign in with the administrator account you created during workspace setup. Add invoices and run
              Interswitch Web Checkout with your own merchant credentials.
            </p>
          </div>

          <div className="relative z-10 flex gap-4">
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-tertiary-fixed"></div>
              <span className="text-sm font-medium">Credentials stored on the server for this demo</span>
            </div>
          </div>

          <div
            className="absolute top-0 right-0 w-full h-full opacity-20 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #ffffff 0%, transparent 50%)' }}
          />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary-container/30 rounded-full blur-[100px]" />
        </div>

        <div className="bg-surface-container-lowest p-8 md:p-16 lg:p-20 flex flex-col justify-center">
          <div className="mb-10 lg:hidden">
            <span className="text-xl font-black tracking-tight text-primary">Kolet Pay</span>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-bold text-on-surface tracking-tight mb-2">Welcome back</h2>
            <p className="text-on-surface-variant font-medium">Sign in to your workspace.</p>
          </div>

          <form className="space-y-6" onSubmit={(e) => void handleSubmit(e)}>
            <div className="space-y-2">
              <label className="block text-sm font-semibold tracking-wide text-on-surface-variant uppercase opacity-80">
                Email
              </label>
              <input
                className="w-full h-14 px-5 bg-surface-container-highest border-none rounded-xl text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all duration-200"
                placeholder="name@company.com"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold tracking-wide text-on-surface-variant uppercase opacity-80">
                Password
              </label>
              <input
                className="w-full h-14 px-5 bg-surface-container-highest border-none rounded-xl text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all duration-200"
                placeholder="••••••••"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {err && <p className="text-sm text-error font-medium">{err}</p>}

            <button
              className="w-full h-14 primary-gradient text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
              type="submit"
              disabled={busy}
            >
              <span>{busy ? 'Signing in…' : 'Sign in'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          <div className="mt-12 text-center">
            <p className="text-on-surface-variant font-medium text-sm">
              Need the docs?{' '}
              <a
                className="text-primary font-bold hover:underline"
                href="https://docs.interswitchgroup.com/docs/home"
                target="_blank"
                rel="noreferrer"
              >
                Interswitch
              </a>
              {' · '}
              <Link className="text-primary font-bold hover:underline" to="/signup">
                Wrong account? Start over (reset workspace)
              </Link>
            </p>
          </div>

          <div className="mt-12 pt-8 border-t border-outline-variant/20 flex flex-wrap justify-center gap-6 opacity-60">
            <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all cursor-default">
              <Lock className="w-4 h-4" />
              <span className="text-[10px] font-bold tracking-widest uppercase">Workspace storage</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
