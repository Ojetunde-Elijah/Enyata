import React, { useCallback, useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { StatusBadge } from '../components/StatusBadge';
import {
  createInvoice,
  createPaymentSession,
  getInvoices,
  getMerchantProfile,
  getPublicConfig,
  type MerchantProfile,
  type PublicConfig,
} from '../api/client';
import { openInlineCheckout } from '../utils/webpay';
import type { Invoice } from '../types';
import {
  Search,
  Share2,
  Download,
  History,
  Mail,
  Copy,
  Trash2,
  Printer,
  CreditCard,
  Plus,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../utils/cn';

export function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [pub, setPub] = useState<PublicConfig | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [payerEmail, setPayerEmail] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payMsg, setPayMsg] = useState<string | null>(null);

  const [newCustomer, setNewCustomer] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newStatus, setNewStatus] = useState<Invoice['status']>('Pending');
  const [createBusy, setCreateBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [inv, p, c] = await Promise.all([getInvoices(), getMerchantProfile(), getPublicConfig()]);
    setInvoices(inv);
    setProfile(p);
    setPub(c);
    setSelectedInvoice((cur) => {
      if (inv.length === 0) return null;
      if (cur && inv.some((i) => i.id === cur.id)) return cur;
      return inv[0];
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch (e) {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : 'Failed to load invoices');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const onCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(newAmount);
    if (!profile?.collectionBank?.accountNumber || !profile?.collectionBank?.bankCode) {
      setPayMsg('Collection bank required. Please configure your bank details in Settings first.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setPayMsg('Enter a valid invoice amount.');
      return;
    }
    setCreateBusy(true);
    try {
      const inv = await createInvoice({
        customer: newCustomer.trim(),
        amount,
        status: newStatus,
      });
      setNewCustomer('');
      setNewAmount('');
      setNewStatus('Pending');
      setPayMsg(null);
      await refresh();
      setSelectedInvoice(inv);
    } catch (ex) {
      setPayMsg(ex instanceof Error ? ex.message : 'Could not create invoice');
    } finally {
      setCreateBusy(false);
    }
  };

  const runCheckout = async () => {
    if (!selectedInvoice || !pub) return;
    setPayMsg(null);
    if (!pub.paymentEnvReady) {
      setPayMsg('Complete Interswitch credentials under Settings (merchant code, pay item, client ID, secret).');
      return;
    }
    if (!payerEmail.trim()) {
      setPayMsg('Payer email is required for Interswitch Web Checkout.');
      return;
    }
    setPayBusy(true);
    try {
      const session = await createPaymentSession({
        amountNaira: selectedInvoice.amount,
        custEmail: payerEmail.trim(),
        custName: selectedInvoice.customer,
        payItemName: `Invoice ${selectedInvoice.id}`,
      });
      await openInlineCheckout(session, pub.inlineCheckoutScriptUrl, (response) => {
        console.info('Interswitch checkout callback', response);
        setPayMsg('Checkout finished — confirm status with server requery (see Interswitch docs).');
      });
    } catch (e) {
      setPayMsg(e instanceof Error ? e.message : 'Payment session failed');
    } finally {
      setPayBusy(false);
    }
  };

  if (loadErr) {
    return (
      <Layout title="Invoices">
        <p className="text-error font-medium">{loadErr}</p>
      </Layout>
    );
  }

  if (!profile || !pub) {
    return (
      <Layout title="Invoices">
        <p className="text-on-surface-variant font-medium">Loading invoices…</p>
      </Layout>
    );
  }

  return (
    <Layout title="Invoices">
      <div className="flex h-[calc(100vh-160px)] -m-12 overflow-hidden">
        <section className="w-full md:w-5/12 lg:w-4/12 flex flex-col bg-surface-container-low border-r border-outline-variant/20">
          <div className="p-6 space-y-4">
            <form
              onSubmit={(e) => void onCreateInvoice(e)}
              className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/15 space-y-3"
            >
              <p className="text-xs font-black uppercase tracking-widest text-primary">New invoice</p>
              <input
                required
                className="w-full px-3 py-2 rounded-lg bg-surface-container-highest text-sm"
                placeholder="Customer name"
                value={newCustomer}
                onChange={(e) => setNewCustomer(e.target.value)}
              />
              <input
                required
                type="number"
                min={1}
                step={1}
                className="w-full px-3 py-2 rounded-lg bg-surface-container-highest text-sm"
                placeholder="Amount (₦)"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
              />
              <select
                className="w-full px-3 py-2 rounded-lg bg-surface-container-highest text-sm font-medium"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as Invoice['status'])}
              >
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
              </select>
              <button
                type="submit"
                disabled={createBusy}
                className="w-full py-2 rounded-lg bg-primary text-on-primary text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {createBusy ? 'Saving…' : 'Add invoice'}
              </button>
              {payMsg && (
                <p className="text-[11px] text-error font-bold leading-tight mt-2 flex flex-col gap-1">
                  <span>{payMsg}</span>
                  {payMsg.includes('Settings') && (
                    <Link to="/settings" className="text-primary hover:underline underline-offset-2">
                       Configure Bank Details →
                    </Link>
                  )}
                </p>
              )}
            </form>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
              <input
                className="w-full pl-10 pr-4 py-3 bg-surface-container-highest border-none rounded-xl focus:ring-2 focus:ring-primary text-sm placeholder:text-on-surface-variant/60"
                placeholder="Search invoices, clients..."
                type="text"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
            {invoices.length === 0 ? (
              <p className="text-sm text-on-surface-variant font-medium px-2">
                No invoices yet. Use the form above to create one.
              </p>
            ) : (
              invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  onClick={() => setSelectedInvoice(invoice)}
                  className={cn(
                    'p-4 rounded-xl shadow-sm border-l-4 transition-all cursor-pointer',
                    selectedInvoice?.id === invoice.id
                      ? 'bg-surface-container-lowest border-primary'
                      : 'bg-surface hover:bg-surface-container-highest border-transparent'
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span
                      className={cn(
                        'text-xs font-bold tracking-wider',
                        selectedInvoice?.id === invoice.id ? 'text-primary' : 'text-on-surface-variant'
                      )}
                    >
                      {invoice.id}
                    </span>
                    <StatusBadge status={invoice.status} className="text-[9px]" />
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <h3 className="font-bold text-on-surface">{invoice.customer}</h3>
                      <p className="text-xs text-on-surface-variant">{invoice.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-on-surface">₦{invoice.amount.toLocaleString()}</p>
                      <p className="text-[10px] text-on-surface-variant">{invoice.items} items</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="hidden md:flex flex-1 bg-surface flex-col overflow-y-auto">
          {!selectedInvoice ? (
            <div className="p-12 flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <h2 className="text-xl font-black text-on-surface mb-2">No invoice selected</h2>
              <p className="text-on-surface-variant text-sm">
                Create an invoice in the left panel to preview it here and collect payment with Interswitch.
              </p>
            </div>
          ) : (
            <>
              <div className="p-8 flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center bg-surface-container-low/50">
                <div>
                  <h1 className="text-2xl font-black text-on-surface tracking-tight">Invoice Detail</h1>
                  <p className="text-sm text-on-surface-variant">Review and manage e-invoice</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <input
                    type="email"
                    value={payerEmail}
                    onChange={(e) => setPayerEmail(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-surface-container-highest text-sm font-medium min-w-[200px]"
                    placeholder="Payer email (required)"
                    aria-label="Payer email for checkout"
                  />
                  <button
                    type="button"
                    disabled={payBusy || !selectedInvoice}
                    onClick={() => void runCheckout()}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white font-semibold rounded-lg shadow-sm hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span className="text-xs">{payBusy ? 'Opening…' : 'Collect with Interswitch'}</span>
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-2 px-4 py-2 bg-surface-container-highest text-on-surface font-semibold rounded-lg hover:bg-surface-variant transition-colors active:scale-95"
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="text-xs">Share via WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary font-semibold rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span className="text-xs">Download PDF</span>
                  </button>
                </div>
              </div>
              {payMsg && <div className="px-8 text-sm text-amber-800 font-medium">{payMsg}</div>}

              <div className="p-8 grid grid-cols-1 xl:grid-cols-12 gap-8">
                <div className="xl:col-span-8 bg-white shadow-2xl rounded-2xl overflow-hidden border border-outline-variant/10">
                  <div className="bg-primary p-8 text-on-primary flex justify-between items-center">
                    <div>
                      <h2 className="text-2xl font-black tracking-tighter">Kolet Pay</h2>
                      <p className="text-xs opacity-80 uppercase tracking-widest font-bold">Official E-Invoice</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{selectedInvoice.id}</p>
                      <p className="text-xs opacity-70">Issued: {selectedInvoice.date}</p>
                    </div>
                  </div>

                  <div className="p-8 space-y-10">
                    <div className="flex justify-between">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">From</p>
                        <h4 className="font-bold text-on-surface">{profile.legalBusinessName}</h4>
                        <p className="text-sm text-on-surface-variant max-w-[220px]">{profile.registeredAddress}</p>
                        <p className="text-[10px] text-on-surface-variant font-mono mt-2">
                          Merchant {profile.merchantCode} · Pay item {profile.payItemId}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">Bill To</p>
                        <h4 className="font-bold text-on-surface">{selectedInvoice.customer}</h4>
                        <p className="text-sm text-on-surface-variant max-w-[200px]">Billing address on file</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-12 border-b border-outline-variant pb-2 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
                        <div className="col-span-6">Description</div>
                        <div className="col-span-2 text-center">Qty</div>
                        <div className="col-span-2 text-right">Rate</div>
                        <div className="col-span-2 text-right">Amount</div>
                      </div>
                      <div className="grid grid-cols-12 text-sm">
                        <div className="col-span-6">
                          <p className="font-bold text-on-surface">Invoice total (NGN)</p>
                          <p className="text-xs text-on-surface-variant italic">Amount due for {selectedInvoice.id}</p>
                        </div>
                        <div className="col-span-2 text-center text-on-surface">1</div>
                        <div className="col-span-2 text-right text-on-surface">
                          ₦{selectedInvoice.amount.toLocaleString()}
                        </div>
                        <div className="col-span-2 text-right font-bold text-on-surface">
                          ₦{selectedInvoice.amount.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-end pt-6 border-t border-outline-variant/30">
                      <div className="bg-surface-container-low p-4 rounded-xl border border-dashed border-outline-variant flex items-center gap-4">
                        <div className="w-24 h-24 bg-slate-900 rounded flex items-center justify-center">
                          <div className="w-8 h-8 bg-white rounded-sm"></div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
                            Interswitch
                          </p>
                          <p className="text-[10px] text-on-surface-variant">
                            Mode {profile.integrationMode}
                            {profile.tillAlias ? ` · Till alias ${profile.tillAlias}` : ''}
                          </p>
                          <p className="text-[10px] text-on-surface-variant font-mono">
                            Settlement ref: {profile.merchantCode}
                          </p>
                        </div>
                      </div>
                      <div className="w-64 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-on-surface-variant">Subtotal</span>
                          <span className="text-on-surface font-semibold">
                            ₦{selectedInvoice.amount.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-outline-variant text-xl">
                          <span className="font-black text-on-surface">Total</span>
                          <span className="font-black text-primary">₦{selectedInvoice.amount.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-4 space-y-6">
                  <div className="bg-surface-container-low p-6 rounded-2xl space-y-4">
                    <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                      <History className="w-4 h-4" />
                      Payment Timeline
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      Timeline will reflect gateway events once you confirm payments via requery.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      className="bg-surface-container-highest p-4 rounded-xl flex flex-col items-center gap-2 hover:bg-surface-variant transition-colors group"
                    >
                      <Mail className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Resend Email</span>
                    </button>
                    <button
                      type="button"
                      className="bg-surface-container-highest p-4 rounded-xl flex flex-col items-center gap-2 hover:bg-surface-variant transition-colors group"
                    >
                      <Copy className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Duplicate</span>
                    </button>
                    <button
                      type="button"
                      className="bg-surface-container-highest p-4 rounded-xl flex flex-col items-center gap-2 hover:bg-surface-variant transition-colors group"
                    >
                      <Trash2 className="w-5 h-5 text-error group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-error">Void Invoice</span>
                    </button>
                    <button
                      type="button"
                      className="bg-surface-container-highest p-4 rounded-xl flex flex-col items-center gap-2 hover:bg-surface-variant transition-colors group"
                    >
                      <Printer className="w-5 h-5 text-on-surface-variant group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Print Receipt</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </Layout>
  );
}
