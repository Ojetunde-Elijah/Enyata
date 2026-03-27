import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, CreditCard, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { openInlineCheckout } from '../utils/webpay';

interface PublicInvoiceData {
  invoice: {
    id: string;
    number: string;
    customerName: string;
    amount: number;
    currency: string;
    status: string;
  };
  businessName: string;
  merchantCode: string;
}

export function PublicPayment() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [data, setData] = useState<PublicInvoiceData | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchInvoice();
  }, [invoiceId]);

  async function fetchInvoice() {
    try {
      const resp = await fetch(`/public/invoice/${invoiceId}`);
      if (!resp.ok) throw new Error('Invoice not found or expired');
      const json = await resp.json();
      setData(json);
      // Pre-fill email if available in invoice (note: our current invoice schema might not have it, but we can add)
      if (json.invoice.customerEmail) setEmail(json.invoice.customerEmail);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handlePayment = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address to proceed.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const resp = await fetch('/public/payments/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, custEmail: email }),
      });

      if (!resp.ok) {
        const errJson = await resp.json();
        throw new Error(errJson.error || 'Could not initiate payment');
      }

      const session = await resp.json();
      
      // Load script URL from config or use common test/live logic
      // For now, we use the same loader as internal app
      const scriptUrl = session.mode === 'LIVE' 
        ? 'https://newwebpay.interswitchng.com/inline-checkout.js'
        : 'https://newwebpay.qa.interswitchng.com/inline-checkout.js';

      await openInlineCheckout(session, scriptUrl, (response: any) => {
        console.log('Payment result:', response);
        if (response.resp === '00' || response.desc === 'Approved') {
          setSuccess(true);
        } else {
          setError(`Payment failed: ${response.desc || 'Unknown error'}`);
        }
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-[#FF3D00] animate-spin mb-4" />
        <p className="text-gray-400 font-medium">Loading payment details...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#141416] border border-white/5 rounded-3xl p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Payment Successful</h1>
          <p className="text-gray-400 mb-8">
            Thank you for your payment to <span className="text-white font-medium">{data?.businessName}</span>. 
            A receipt has been sent to your email.
          </p>
          <button 
            onClick={() => window.close()} 
            className="w-full bg-white/5 hover:bg-white/10 text-white font-semibold py-4 rounded-2xl transition-all"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-4 selection:bg-[#FF3D00]/30">
      <div className="max-w-[480px] w-full">
        {/* Merchant Branding */}
        <div className="text-center mb-8 px-4">
          <div className="w-16 h-16 bg-gradient-to-tr from-[#FF3D00] to-[#FF6D00] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#FF3D00]/20 rotate-3 transition-transform hover:rotate-0">
            <span className="text-white text-2xl font-bold">
              {data?.businessName?.charAt(0) || 'K'}
            </span>
          </div>
          <h2 className="text-white text-xl font-bold tracking-tight mb-1">{data?.businessName}</h2>
          <p className="text-gray-500 text-sm">Secure Payment Request</p>
        </div>

        {/* Main Card */}
        <div className="bg-[#141416] border border-white/5 rounded-[40px] p-8 md:p-10 shadow-2xl relative overflow-hidden">
           {/* Abstract Background Detail */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#FF3D00]/5 blur-[80px] rounded-full" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#FF3D00]/5 blur-[80px] rounded-full" />

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-200 leading-relaxed">{error}</p>
            </div>
          )}

          <div className="space-y-8">
            {/* Amount Section */}
            <div className="text-center">
              <p className="text-gray-400 text-sm font-medium uppercase tracking-widest mb-2">Amount to Pay</p>
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-2xl md:text-3xl font-medium text-[#FF3D00]">₦</span>
                <span className="text-5xl md:text-6xl font-bold text-white tracking-tighter">
                  {data?.invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="inline-flex items-center gap-2 mt-4 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                <span className="text-xs text-gray-400">Invoice:</span>
                <span className="text-xs text-white font-mono">{data?.invoice.number}</span>
              </div>
            </div>

            <div className="h-px bg-white/5 w-full" />

            {/* Form Section */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2 ml-1">
                  Customer Email
                </label>
                <div className="relative group">
                  <input
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#1C1C1F] border border-white/5 rounded-2xl px-5 py-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FF3D00]/40 transition-all duration-300 group-hover:bg-[#222226]"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-2 ml-1">
                  We'll send your payment receipt to this address.
                </p>
              </div>

              <button
                onClick={handlePayment}
                disabled={processing}
                className="group relative w-full bg-[#FF3D00] hover:bg-[#FF5100] disabled:opacity-50 disabled:cursor-not-allowed text-white font-inter font-bold py-5 rounded-2xl transition-all duration-300 shadow-xl shadow-[#FF3D00]/20 active:scale-[0.98] overflow-hidden"
              >
                <div className="flex items-center justify-center gap-2">
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>SECURE PROCESSING...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-5 h-5 transition-transform group-hover:scale-110" />
                      <span>PAY WITH INTERSWITCH</span>
                      <ArrowRight className="w-5 h-5 transition-transform translate-x-0 group-hover:translate-x-1" />
                    </>
                  )}
                </div>
              </button>
            </div>

            {/* Trust Badges */}
            <div className="flex items-center justify-center gap-6 pt-4 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
               <div className="flex flex-col items-center gap-1">
                 <Shield className="w-4 h-4 text-gray-400" />
                 <span className="text-[9px] uppercase tracking-tighter text-gray-500">Secure</span>
               </div>
               <div className="flex flex-col items-center gap-1 text-[9px] uppercase tracking-tighter text-gray-500 font-bold">
                 <span>PCI DSS</span>
                 <span>Compliant</span>
               </div>
               <div className="flex flex-col items-center gap-1">
                 <CreditCard className="w-4 h-4 text-gray-400" />
                 <span className="text-[9px] uppercase tracking-tighter text-gray-500">Encrypted</span>
               </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center mt-8 text-gray-600 text-[11px] tracking-wide">
          Powered by <span className="text-[#FF3D00] font-bold">Antigravity</span> & <span className="text-white">Interswitch</span>
        </p>
      </div>
    </div>
  );
}
