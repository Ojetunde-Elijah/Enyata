import React, { useEffect, useState } from 'react';
import { Wallet, ArrowRight, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getSetupStatus, signup, setToken } from '../api/client';

const defaultForm = {
  email: '',
  password: '',
  confirmPassword: '',
  businessLegalName: '',
  registeredAddress: '',
  mobileNo: '',
  firstName: '',
  lastName: '',
  nin: '',
  bvn: '',
  tin: '',
  bankCode: '',
  accountNumber: '',
  accountName: '',
};

type FormKey = keyof typeof defaultForm;

export function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState(defaultForm);
  const [busy, setBusy] = useState(false);
  const [busyStage, setBusyStage] = useState<'verifying' | 'saving' | null>(null);
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
    return () => { cancelled = true; };
  }, [navigate]);

  const set =
    (key: FormKey) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };

  const validateKyc = (): string | null => {
    if (!/^\d{11}$/.test(form.nin.trim())) return 'NIN must be exactly 11 digits.';
    if (!/^\d{11}$/.test(form.bvn.trim())) return 'BVN must be exactly 11 digits.';
    if (form.tin.trim() && !/^\d{8}-\d{4}$/.test(form.tin.trim())) {
      return 'TIN format must be XXXXXXXX-XXXX (e.g. 08120451-1001).';
    }
    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (form.password !== form.confirmPassword) {
      setErr('Passwords do not match.');
      return;
    }
    const kycErr = validateKyc();
    if (kycErr) { setErr(kycErr); return; }

    setBusy(true);
    setBusyStage('verifying');
    try {
      const { token } = await signup({
        email: form.email.trim(),
        password: form.password,
        businessLegalName: form.businessLegalName.trim(),
        registeredAddress: form.registeredAddress.trim(),
        mobileNo: form.mobileNo.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        nin: form.nin.trim(),
        bvn: form.bvn.trim(),
        tin: form.tin.trim() || undefined,
        collectionBank: {
          accountNumber: form.accountNumber.trim(),
          bankCode: form.bankCode.trim(),
          accountName: form.accountName.trim(),
        },
      });
      setBusyStage('saving');
      setToken(token);
      navigate('/dashboard', { replace: true });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Signup failed');
    } finally {
      setBusy(false);
      setBusyStage(null);
    }
  };

  const fieldCls =
    'w-full h-12 px-4 bg-surface-container-highest border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';
  const legendCls =
    'text-xs font-black uppercase tracking-widest text-primary px-1';

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface">
      <div className="w-full max-w-lg bg-surface-container-low rounded-xl overflow-hidden shadow-2xl shadow-on-surface/5 p-8 md:p-12">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
            <Wallet className="text-primary-container w-6 h-6" />
          </div>
          <span className="text-2xl font-black tracking-tight text-primary">Kolet Pay</span>
        </div>

        <h1 className="text-2xl font-bold text-on-surface tracking-tight mb-2">Create your workspace</h1>
        <p className="text-on-surface-variant text-sm font-medium mb-8">
          Create an account to start accepting payments and managing your business seamlessly with Kolet Pay.
        </p>

        <form className="space-y-5" onSubmit={(e) => void onSubmit(e)}>

          {/* ── Account ───────────────────────────── */}
          <fieldset className="space-y-3 border border-outline-variant/20 rounded-xl p-4">
            <legend className={legendCls}>Account</legend>
            <input
              id="signup-email"
              type="email"
              required
              className={fieldCls}
              placeholder="Work email"
              value={form.email}
              onChange={set('email')}
            />
            <input
              id="signup-password"
              type="password"
              required
              minLength={8}
              className={fieldCls}
              placeholder="Password (min 8 characters)"
              value={form.password}
              onChange={set('password')}
            />
            <input
              id="signup-confirm-password"
              type="password"
              required
              className={fieldCls}
              placeholder="Confirm password"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
            />
          </fieldset>

          {/* ── Business ──────────────────────────── */}
          <fieldset className="space-y-3 border border-outline-variant/20 rounded-xl p-4">
            <legend className={legendCls}>Business</legend>
            <input
              id="signup-business-name"
              type="text"
              required
              className={fieldCls}
              placeholder="Legal business name"
              value={form.businessLegalName}
              onChange={set('businessLegalName')}
            />
            <textarea
              id="signup-address"
              required
              className="w-full px-4 py-3 bg-surface-container-highest border-none rounded-xl text-sm min-h-[88px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Registered address"
              value={form.registeredAddress}
              onChange={set('registeredAddress')}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                id="signup-first-name"
                type="text"
                required
                className={fieldCls}
                placeholder="First name"
                value={form.firstName}
                onChange={set('firstName')}
              />
              <input
                id="signup-last-name"
                type="text"
                required
                className={fieldCls}
                placeholder="Last name"
                value={form.lastName}
                onChange={set('lastName')}
              />
            </div>
            <input
              id="signup-mobile"
              type="text"
              required
              className={fieldCls}
              placeholder="Mobile number (e.g. 08012345678)"
              value={form.mobileNo}
              onChange={set('mobileNo')}
            />
          </fieldset>

          {/* ── Identity Verification (KYC) ───────── */}
          <fieldset className="space-y-3 border border-primary/20 rounded-xl p-4 bg-primary/[0.03]">
            <legend className={legendCls}>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Identity Verification (KYC)
              </span>
            </legend>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Your identity is verified via the Interswitch API Marketplace.
              In <strong>sandbox mode</strong>, use the Postman test IDs shown in the placeholders.
            </p>

            <input
              id="signup-nin"
              type="text"
              inputMode="numeric"
              required
              pattern="\d{11}"
              title="NIN must be exactly 11 digits"
              maxLength={11}
              className={fieldCls}
              placeholder="NIN — 11 digits  (test: 63184876213)"
              value={form.nin}
              onChange={set('nin')}
            />

            <input
              id="signup-bvn"
              type="text"
              inputMode="numeric"
              required
              pattern="\d{11}"
              title="BVN must be exactly 11 digits"
              maxLength={11}
              className={fieldCls}
              placeholder="BVN — 11 digits  (test: 95888168924)"
              value={form.bvn}
              onChange={set('bvn')}
            />

            <div>
              <input
                id="signup-tin"
                type="text"
                pattern="\d{8}-\d{4}"
                title="TIN format: XXXXXXXX-XXXX"
                className={fieldCls}
                placeholder="TIN — optional  (test: 08120451-1001)"
                value={form.tin}
                onChange={set('tin')}
              />
              <p className="text-xs text-on-surface-variant mt-1 px-1">Format: XXXXXXXX-XXXX (optional)</p>
            </div>
          </fieldset>

          {/* ── Collection Bank ───────────────────── */}
          <fieldset className="space-y-3 border border-outline-variant/20 rounded-xl p-4">
            <legend className={legendCls}>Collection Bank</legend>
            <input
              id="signup-bank-code"
              type="text"
              required
              className={fieldCls}
              placeholder="Bank code (e.g. 044 = Access Bank)"
              value={form.bankCode}
              onChange={set('bankCode')}
            />
            <input
              id="signup-account-number"
              type="text"
              required
              className={fieldCls}
              placeholder="Account number"
              value={form.accountNumber}
              onChange={set('accountNumber')}
            />
            <input
              id="signup-account-name"
              type="text"
              className={fieldCls}
              placeholder="Account name"
              value={form.accountName}
              onChange={set('accountName')}
            />
          </fieldset>

          {err && (
            <div className="p-3 bg-error/10 border border-error/20 rounded-xl">
              <p className="text-sm text-error font-medium">{err}</p>
            </div>
          )}

          <button
            id="signup-submit"
            type="submit"
            disabled={busy}
            className="w-full h-14 primary-gradient text-white rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <span>
              {busyStage === 'verifying'
                ? 'Verifying identity…'
                : busyStage === 'saving'
                  ? 'Creating workspace…'
                  : 'Create workspace'}
            </span>
            {!busy && <ArrowRight className="w-5 h-5" />}
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
