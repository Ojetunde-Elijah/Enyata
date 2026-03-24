import React, { useEffect, useState } from 'react';
import { Wallet, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getSetupStatus, signup, setToken } from '../api/client';

const defaultForm = {
  email: '',
  password: '',
  confirmPassword: '',
  businessLegalName: '',
  registeredAddress: '',
  merchantCode: '',
  payItemId: '',
  clientId: '',
  secretKey: '',
  mode: 'TEST' as 'TEST' | 'LIVE',
  tillAlias: '',
  dataRef: '',
};

export function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState(defaultForm);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { hasWorkspace } = await getSetupStatus();
        if (!cancelled && hasWorkspace) navigate('/login', { replace: true });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const v = e.target.value;
      setForm((f) => ({ ...f, [key]: v }));
    };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (form.password !== form.confirmPassword) {
      setErr('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const { token } = await signup({
        email: form.email.trim(),
        password: form.password,
        businessLegalName: form.businessLegalName.trim(),
        registeredAddress: form.registeredAddress.trim(),
        interswitch: {
          merchantCode: form.merchantCode.trim(),
          payItemId: form.payItemId.trim(),
          clientId: form.clientId.trim(),
          secretKey: form.secretKey.trim(),
          mode: form.mode,
          tillAlias: form.tillAlias.trim(),
          dataRef: form.dataRef.trim(),
        },
      });
      setToken(token);
      navigate('/dashboard', { replace: true });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Signup failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface">
      <div className="w-full max-w-lg bg-surface-container-low rounded-xl overflow-hidden shadow-2xl shadow-on-surface/5 p-8 md:p-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
            <Wallet className="text-primary-container w-6 h-6" />
          </div>
          <span className="text-2xl font-black tracking-tight text-primary">Kolet Pay</span>
        </div>

        <h1 className="text-2xl font-bold text-on-surface tracking-tight mb-2">Create your workspace</h1>
        <p className="text-on-surface-variant text-sm font-medium mb-8">
          One administrator account and your Interswitch (Quickteller Business) credentials. Everything is stored
          locally in <span className="font-mono text-xs">data/workspace.json</span> for this demo.
        </p>

        <form className="space-y-5" onSubmit={(e) => void onSubmit(e)}>
          <fieldset className="space-y-3 border border-outline-variant/20 rounded-xl p-4">
            <legend className="text-xs font-black uppercase tracking-widest text-primary px-1">Account</legend>
            <input
              type="email"
              required
              className="w-full h-12 px-4 bg-surface-container-highest border-none rounded-xl text-sm"
              placeholder="Work email"
              value={form.email}
              onChange={set('email')}
            />
            <input
              type="password"
              required
              minLength={8}
              className="w-full h-12 px-4 bg-surface-container-highest border-none rounded-xl text-sm"
              placeholder="Password (min 8 characters)"
              value={form.password}
              onChange={set('password')}
            />
            <input
              type="password"
              required
              className="w-full h-12 px-4 bg-surface-container-highest border-none rounded-xl text-sm"
              placeholder="Confirm password"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
            />
          </fieldset>

          <fieldset className="space-y-3 border border-outline-variant/20 rounded-xl p-4">
            <legend className="text-xs font-black uppercase tracking-widest text-primary px-1">Business</legend>
            <input
              type="text"
              required
              className="w-full h-12 px-4 bg-surface-container-highest border-none rounded-xl text-sm"
              placeholder="Legal business name"
              value={form.businessLegalName}
              onChange={set('businessLegalName')}
            />
            <textarea
              required
              className="w-full px-4 py-3 bg-surface-container-highest border-none rounded-xl text-sm min-h-[88px] resize-none"
              placeholder="Registered address"
              value={form.registeredAddress}
              onChange={set('registeredAddress')}
            />
          </fieldset>

          <fieldset className="space-y-3 border border-outline-variant/20 rounded-xl p-4">
            <legend className="text-xs font-black uppercase tracking-widest text-primary px-1">Interswitch</legend>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Paste the values from your Quickteller Business / developer profile. See{' '}
              <a
                className="text-primary font-bold"
                href="https://docs.interswitchgroup.com/docs/home"
                target="_blank"
                rel="noreferrer"
              >
                Interswitch docs
              </a>
              .
            </p>
            <select
              className="w-full h-12 px-4 bg-surface-container-highest border-none rounded-xl text-sm font-semibold"
              value={form.mode}
              onChange={set('mode')}
            >
              <option value="TEST">TEST (sandbox)</option>
              <option value="LIVE">LIVE</option>
            </select>
            <input
              type="text"
              required
              className="w-full h-12 px-4 bg-surface-container-highest border-none rounded-xl text-sm font-mono text-xs"
              placeholder="Merchant code (e.g. MX…)"
              value={form.merchantCode}
              onChange={set('merchantCode')}
            />
            <input
              type="text"
              required
              className="w-full h-12 px-4 bg-surface-container-highest border-none rounded-xl text-sm font-mono text-xs"
              placeholder="Pay item ID"
              value={form.payItemId}
              onChange={set('payItemId')}
            />
            <input
              type="text"
              required
              className="w-full h-12 px-4 bg-surface-container-highest border-none rounded-xl text-sm font-mono text-xs"
              placeholder="Client ID"
              value={form.clientId}
              onChange={set('clientId')}
            />
            <input
              type="password"
              required
              className="w-full h-12 px-4 bg-surface-container-highest border-none rounded-xl text-sm"
              placeholder="Secret key"
              value={form.secretKey}
              onChange={set('secretKey')}
            />
            <input
              type="text"
              className="w-full h-12 px-4 bg-surface-container-highest border-none rounded-xl text-sm"
              placeholder="Till alias (optional)"
              value={form.tillAlias}
              onChange={set('tillAlias')}
            />
            <input
              type="text"
              className="w-full h-12 px-4 bg-surface-container-highest border-none rounded-xl text-sm font-mono text-xs"
              placeholder="Data ref (optional)"
              value={form.dataRef}
              onChange={set('dataRef')}
            />
          </fieldset>

          {err && <p className="text-sm text-error font-medium">{err}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full h-14 primary-gradient text-white rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <span>{busy ? 'Saving…' : 'Create workspace'}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-on-surface-variant">
          Already set up?{' '}
          <Link className="text-primary font-bold hover:underline" to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
