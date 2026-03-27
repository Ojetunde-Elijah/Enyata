import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { StatusBadge } from '../components/StatusBadge';
import { cn } from '../utils/cn';
import { getDashboard, getPublicConfig, requestWithdrawal, type DashboardPayload, type PublicConfig } from '../api/client';
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  Plus,
  ShieldCheck,
  Wallet,
} from 'lucide-react';

export function Dashboard() {
  const [dash, setDash] = useState<DashboardPayload | null>(null);
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [d, c] = await Promise.all([getDashboard(), getPublicConfig()]);
        if (!cancelled) {
          setDash(d);
          setCfg(c);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : 'Failed to load dashboard');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (err) {
    return (
      <Layout title="Business Overview">
        <p className="text-error font-medium">{err}</p>
      </Layout>
    );
  }

  if (!dash || !cfg) {
    return (
      <Layout title="Business Overview">
        <p className="text-on-surface-variant font-medium">Loading overview…</p>
      </Layout>
    );
  }

  const stats = [
    {
      label: 'Total Revenue (₦)',
      value: dash.stats.revenueFormatted,
      trend: dash.stats.revenueTrendLabel,
      icon: TrendingUp,
      color: 'primary' as const,
    },
    {
      label: 'Outstanding Invoices',
      value: dash.stats.outstandingFormatted,
      sub: `${dash.stats.openInvoiceCount} open • ${dash.stats.overdueInvoiceCount} overdue`,
      icon: Clock,
      color: 'secondary' as const,
    },
    {
      label: 'Success Rate',
      value: dash.stats.successRateFormatted,
      sub: 'Reconciliation',
      icon: CheckCircle2,
      color: 'tertiary' as const,
    },
  ];

  const handleWithdraw = async () => {
     if (!dash?.payout.estimatedNaira) return;
     setWithdrawing(true);
     setWithdrawMsg(null);
     try {
       await requestWithdrawal(dash.payout.estimatedNaira);
       setWithdrawMsg('Withdrawal successful!');
     } catch (e: any) {
       setWithdrawMsg(e.message || 'Withdrawal failed');
     } finally {
       setWithdrawing(false);
     }
  };

  return (
    <Layout title="Business Overview">
      <div className="space-y-10">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-black text-on-surface tracking-tight">Business Overview</h2>
            <p className="text-slate-500 mt-1 font-medium">Manage your wholesale receivables and reconciliation.</p>
          </div>
          <button className="flex items-center gap-2 px-6 py-3.5 bg-primary text-white rounded-xl font-bold shadow-md hover:bg-blue-900 transition-all active:scale-95">
            <Plus className="w-5 h-5" />
            <span>New Invoice</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="bg-white p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 shadow-sm border-l-4 border-primary">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-primary-container/20 rounded-full flex items-center justify-center">
                <ShieldCheck className="text-primary w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface">Interswitch checkout</h3>
                <p className="text-slate-500 text-sm">
                  {cfg.mode === 'TEST'
                    ? 'Test environment — use sandbox cards.'
                    : 'Live mode enabled.'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Merchant code</p>
                <p className="font-mono font-bold text-on-surface">{cfg.merchantCode || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Mode</p>
                <span className="font-mono text-xs font-black text-primary tracking-wide">{cfg.mode}</span>
              </div>
            </div>
          </section>

          <section className="bg-gradient-to-br from-primary to-blue-900 p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 shadow-md text-white">
             <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center">
                <Wallet className="text-white w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Virtual Settlement Account</h3>
                <p className="text-white/70 text-sm">₦0.00 Available Balance</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              {dash.virtualWallet?.virtualAccount ? (
                <>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1">Account Number</p>
                    <p className="font-mono font-bold tracking-wider">{dash.virtualWallet.virtualAccount.accountNumber}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1">Bank</p>
                    <p className="font-bold">{dash.virtualWallet.virtualAccount.bankName}</p>
                  </div>
                </>
              ) : (
                <div className="py-2">
                   <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1">Status</p>
                   <p className="text-xs font-bold bg-white/10 px-3 py-1 rounded-lg">Verification Pending</p>
                </div>
              )}
            </div>
          </section>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-48 group hover:border-primary/20 transition-all"
            >
              <div className="flex justify-between items-start">
                <div
                  className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center',
                    stat.color === 'primary'
                      ? 'bg-primary-container/20 text-primary'
                      : stat.color === 'secondary'
                        ? 'bg-secondary-container/20 text-secondary'
                        : 'bg-tertiary-container/20 text-tertiary'
                  )}
                >
                  <stat.icon className="w-6 h-6" />
                </div>
                {stat.trend && (
                  <span className="text-tertiary text-xs font-black bg-tertiary-container/20 px-2 py-1 rounded-md">
                    {stat.trend}
                  </span>
                )}
              </div>
              <div>
                <p className="text-slate-500 text-sm font-bold">{stat.label}</p>
                <h4 className="text-3xl font-black text-on-surface mt-1">{stat.value}</h4>
                {stat.sub && (
                  <p className="text-xs text-slate-400 mt-3 flex items-center font-semibold">
                    <Clock className="w-3 h-3 mr-1.5" /> {stat.sub}
                  </p>
                )}
                {!stat.sub && (
                  <div className="mt-4 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.min(dash.stats.successRatePercent, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
          <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center">
              <h3 className="text-xl font-black text-on-surface">Recent Invoices</h3>
              <button className="text-primary text-sm font-bold hover:underline">View All</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-8 py-4 text-[10px] uppercase tracking-widest text-slate-400 font-bold">Customer</th>
                    <th className="px-8 py-4 text-[10px] uppercase tracking-widest text-slate-400 font-bold">Amount</th>
                    <th className="px-8 py-4 text-[10px] uppercase tracking-widest text-slate-400 font-bold">Status</th>
                    <th className="px-8 py-4 text-[10px] uppercase tracking-widest text-slate-400 font-bold text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {dash.recentInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-8 py-10 text-center text-slate-500 text-sm font-medium">
                        No invoices yet — create one from the Invoices page.
                      </td>
                    </tr>
                  ) : (
                    dash.recentInvoices.map((invoice, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-primary text-xs font-bold">
                              {invoice.initials}
                            </div>
                            <span className="font-bold text-on-surface text-sm">{invoice.customer}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5 font-mono text-sm font-bold text-on-surface">{invoice.amountFormatted}</td>
                        <td className="px-8 py-5">
                          <StatusBadge status={invoice.status} />
                        </td>
                        <td className="px-8 py-5 text-right text-sm font-semibold text-slate-400">{invoice.date}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
            <div className="mb-10">
              <h3 className="text-xl font-black text-on-surface">Sales Trends</h3>
              <p className="text-sm font-semibold text-slate-400">Monthly revenue performance</p>
            </div>
            <div className="flex-1 flex items-end justify-between gap-3 h-56 px-2">
              {dash.salesTrendHeights.map((h, i) => (
                <div key={i} className="flex flex-col items-center gap-3 flex-1">
                  <div
                    className={cn(
                      'w-full rounded-lg transition-all',
                      i === 3 ? 'bg-primary shadow-lg' : 'bg-slate-50 hover:bg-slate-100'
                    )}
                    style={{ height: `${h}%` }}
                  />
                  <span
                    className={cn(
                      'text-[10px] font-black uppercase',
                      i === 3 ? 'text-primary' : 'text-slate-400'
                    )}
                  >
                    {dash.salesTrendLabels[i] ?? ''}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-10 p-5 bg-slate-50 rounded-2xl border border-slate-100/50">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Next Payout</span>
                <span className="text-sm font-black text-on-surface">{dash.payout.nextDate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Estimated Amount</span>
                <span className="text-lg font-black text-primary">{dash.payout.estimatedFormatted}</span>
              </div>
              
              {withdrawMsg && <p className="text-xs font-medium mt-3 text-center text-primary">{withdrawMsg}</p>}
              <button
                disabled={withdrawing || dash.payout.estimatedNaira <= 0}
                onClick={() => void handleWithdraw()}
                className="w-full mt-4 py-2 bg-primary text-white text-sm font-bold rounded-xl disabled:opacity-50"
              >
                {withdrawing ? 'Processing...' : 'Withdraw to Bank'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
