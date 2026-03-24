import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import {
  Building2,
  CreditCard,
  MessageSquare,
  Shield,
  Bell,
  Users,
  ExternalLink,
  Smartphone,
  Globe,
} from 'lucide-react';
import { getMerchantProfile, saveSettings, type MerchantProfile } from '../api/client';

export function Settings() {
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [businessLegalName, setBusinessLegalName] = useState('');
  const [registeredAddress, setRegisteredAddress] = useState('');
  const [merchantCode, setMerchantCode] = useState('');
  const [payItemId, setPayItemId] = useState('');
  const [clientId, setClientId] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [mode, setMode] = useState<'TEST' | 'LIVE'>('TEST');
  const [tillAlias, setTillAlias] = useState('');
  const [dataRef, setDataRef] = useState('');

  const load = async () => {
    const p = await getMerchantProfile();
    setProfile(p);
    setBusinessLegalName(p.legalBusinessName);
    setRegisteredAddress(p.registeredAddress);
    setMerchantCode(p.merchantCode);
    setPayItemId(p.payItemId);
    setClientId('');
    setSecretKey('');
    setMode(p.integrationMode);
    setTillAlias(p.tillAlias ?? '');
    setDataRef('');
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!cancelled) await load();
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load profile');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOkMsg(null);
    setBusy(true);
    try {
      const interswitch: {
        merchantCode: string;
        payItemId: string;
        mode: 'TEST' | 'LIVE';
        tillAlias: string;
        clientId?: string;
        secretKey?: string;
        dataRef?: string;
      } = {
        merchantCode,
        payItemId,
        mode,
        tillAlias,
      };
      if (clientId.trim()) interswitch.clientId = clientId.trim();
      if (secretKey.trim()) interswitch.secretKey = secretKey.trim();
      if (dataRef.trim()) interswitch.dataRef = dataRef.trim();

      await saveSettings({
        businessLegalName: businessLegalName.trim(),
        registeredAddress: registeredAddress.trim(),
        interswitch,
      });
      setOkMsg('Saved.');
      setClientId('');
      setSecretKey('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  if (err && !profile) {
    return (
      <Layout title="Account Configuration">
        <p className="text-error font-medium">{err}</p>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout title="Account Configuration">
        <p className="text-on-surface-variant font-medium">Loading configuration…</p>
      </Layout>
    );
  }

  return (
    <Layout title="Account Configuration">
      <form onSubmit={(e) => void onSave(e)} className="max-w-4xl space-y-10">
        <div>
          <h2 className="text-3xl font-black text-on-surface tracking-tight">Account Configuration</h2>
          <p className="text-slate-500 mt-1 font-medium">
            Values you entered at signup are stored on the server in{' '}
            <span className="font-mono text-xs">data/workspace.json</span>. Update them here anytime.
          </p>
        </div>

        {err && <p className="text-sm text-error font-medium">{err}</p>}
        {okMsg && <p className="text-sm text-tertiary font-medium">{okMsg}</p>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-1">
            {[
              { icon: Building2, label: 'Business Profile', active: true },
              { icon: CreditCard, label: 'Settlement Matrix' },
              { icon: MessageSquare, label: 'WhatsApp Bot' },
              { icon: Shield, label: 'Security & Access' },
              { icon: Bell, label: 'Notifications' },
              { icon: Users, label: 'Team Members' },
            ].map((item, i) => (
              <button
                key={i}
                type="button"
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  item.active
                    ? 'bg-primary text-white shadow-md'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-on-surface'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
          </div>

          <div className="md:col-span-2 space-y-8">
            <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-on-surface">Business Identity</h3>
                <span className="text-[10px] font-black uppercase tracking-widest text-tertiary bg-tertiary-container/20 px-2 py-1 rounded">
                  {mode} mode
                </span>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Legal Business Name
                  </label>
                  <input
                    required
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-on-surface"
                    value={businessLegalName}
                    onChange={(e) => setBusinessLegalName(e.target.value)}
                  />
                </div>
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Merchant code
                  </label>
                  <input
                    required
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-on-surface font-mono"
                    value={merchantCode}
                    onChange={(e) => setMerchantCode(e.target.value)}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Registered Address
                  </label>
                  <textarea
                    required
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-on-surface h-24 resize-none"
                    value={registeredAddress}
                    onChange={(e) => setRegisteredAddress(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-on-surface">Interswitch API (Quickteller)</h3>
                <a
                  className="text-primary text-xs font-bold hover:underline"
                  href="https://docs.interswitchgroup.com/docs/home"
                  target="_blank"
                  rel="noreferrer"
                >
                  Documentation
                </a>
              </div>
              <p className="text-xs text-slate-500">
                Client ID (saved): <span className="font-mono">{profile.clientIdMasked}</span>. Secret:{' '}
                {profile.hasClientSecret ? 'stored (leave blank to keep)' : 'missing'}. To rotate keys, enter new
                values below.
              </p>

              <div className="grid grid-cols-1 gap-4">
                <select
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold"
                  value={mode}
                  onChange={(e) => setMode(e.target.value === 'LIVE' ? 'LIVE' : 'TEST')}
                >
                  <option value="TEST">TEST (sandbox)</option>
                  <option value="LIVE">LIVE</option>
                </select>
                <input
                  required
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-mono text-xs"
                  placeholder="Pay item ID"
                  value={payItemId}
                  onChange={(e) => setPayItemId(e.target.value)}
                />
                <input
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-mono text-xs"
                  placeholder={`New client ID (optional · current ends ${profile.clientIdMasked})`}
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
                <input
                  type="password"
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm"
                  placeholder="New secret key (optional)"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                />
                <input
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm"
                  placeholder="Till alias (optional)"
                  value={tillAlias}
                  onChange={(e) => setTillAlias(e.target.value)}
                />
                <input
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-mono text-xs"
                  placeholder={
                    profile.hasDataRefConfigured
                      ? 'Data ref on file — enter only to replace'
                      : 'Data ref (optional)'
                  }
                  value={dataRef}
                  onChange={(e) => setDataRef(e.target.value)}
                />
              </div>
            </section>

            <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-on-surface">Settlement Matrix</h3>
                <a
                  className="text-primary text-xs font-bold hover:underline"
                  href="https://business.quickteller.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Quickteller Business
                </a>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-lg shadow-sm flex items-center justify-center">
                    <Globe className="text-primary w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface">Interswitch collections</p>
                    <p className="text-xs text-slate-500 font-medium font-mono">Pay item {payItemId}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-tertiary uppercase tracking-widest">Primary</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-lg shadow-sm flex items-center justify-center">
                    <Smartphone className="text-slate-400 w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface">Till / alias</p>
                    <p className="text-xs text-slate-500 font-medium">
                      {tillAlias.trim() ? `Alias ${tillAlias.trim()}` : 'Optional — not set'}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-2xl shadow-lg text-white relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-lg font-bold">WhatsApp Business Bot</h3>
                </div>
                <p className="text-slate-400 text-sm mb-6 max-w-md">
                  Configure messaging integrations from a future release.
                </p>
                <div className="flex gap-4">
                  <button
                    type="button"
                    className="bg-white text-slate-900 px-6 py-2 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all"
                  >
                    Configure Bot
                  </button>
                  <button
                    type="button"
                    className="bg-white/10 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-white/20 transition-all flex items-center gap-2"
                  >
                    Test Flow
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-green-500/10 blur-3xl rounded-full"></div>
            </section>

            <div className="flex justify-end gap-4 pt-4">
              <button
                type="submit"
                disabled={busy}
                className="px-10 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {busy ? 'Saving…' : 'Save configuration'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </Layout>
  );
}
