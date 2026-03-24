import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { BarChart3, TrendingUp, Download, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { getDashboard, type DashboardPayload } from '../api/client';

export function Reports() {
  const [dash, setDash] = useState<DashboardPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await getDashboard();
        if (!cancelled) setDash(d);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load reports');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const avgTx =
    dash && dash.recentInvoices.length > 0
      ? dash.recentInvoices.reduce((s, r) => s + r.amountNaira, 0) / dash.recentInvoices.length
      : 0;

  if (err) {
    return (
      <Layout title="Financial Reports">
        <p className="text-error font-medium">{err}</p>
      </Layout>
    );
  }

  if (!dash) {
    return (
      <Layout title="Financial Reports">
        <p className="text-on-surface-variant font-medium">Loading reports…</p>
      </Layout>
    );
  }

  const bars = dash.salesTrendHeights.length
    ? dash.salesTrendHeights
    : [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20];

  return (
    <Layout title="Financial Reports">
      <div className="space-y-10">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-black text-on-surface tracking-tight">Financial Reports</h2>
            <p className="text-slate-500 mt-1 font-medium">
              Figures are computed from invoices in your workspace (no mock portfolio data).
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-on-surface font-bold rounded-xl hover:bg-slate-50 transition-all"
            >
              <Calendar className="w-5 h-5 text-slate-400" />
              <span>Range</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-bold rounded-xl shadow-md hover:bg-blue-900 transition-all"
            >
              <Download className="w-5 h-5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-lg font-black text-on-surface">Sales trend (dashboard)</h3>
              <div className="flex gap-4 items-center text-xs font-bold text-slate-500">
                <BarChart3 className="w-5 h-5 text-primary" />
                From your live metrics
              </div>
            </div>

            <div className="h-80 w-full flex items-end justify-between gap-4 px-4">
              {bars.map((val, i) => (
                <div key={i} className="flex-1 group relative">
                  <div
                    className="w-full bg-slate-50 rounded-t-lg transition-all group-hover:bg-primary/10"
                    style={{ height: `${Math.min(100, val)}%` }}
                  >
                    <div
                      className="absolute bottom-0 left-0 w-full bg-primary/20 rounded-t-lg transition-all group-hover:bg-primary/40"
                      style={{ height: `${Math.min(100, val * 0.7)}%` }}
                    />
                  </div>
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-black text-slate-400 uppercase">
                    {dash.salesTrendLabels[i] ?? ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][i % 12]}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-black text-on-surface mb-6">Key metrics</h3>
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Avg. shown invoice
                    </p>
                    <p className="text-xl font-black text-on-surface">
                      {avgTx > 0 ? `₦ ${Math.round(avgTx).toLocaleString()}` : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-tertiary font-bold text-sm">
                    <ArrowUpRight className="w-4 h-4" />
                    {dash.stats.revenueTrendLabel}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Outstanding</p>
                    <p className="text-xl font-black text-on-surface">{dash.stats.outstandingFormatted}</p>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500 font-bold text-sm">
                    <ArrowDownRight className="w-4 h-4" />
                    {dash.stats.openInvoiceCount} open
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Success rate</p>
                    <p className="text-xl font-black text-on-surface">{dash.stats.successRateFormatted}</p>
                  </div>
                  <div className="flex items-center gap-1 text-tertiary font-bold text-sm">
                    <ArrowUpRight className="w-4 h-4" />
                    Paid / total
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 p-8 rounded-2xl shadow-lg text-white">
              <TrendingUp className="w-10 h-10 text-primary-container mb-4" />
              <h3 className="text-lg font-bold mb-2">Workspace data</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Report totals update when you add or change invoices. There is no bundled demo dataset—everything
                reflects your signup inputs and activity.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
