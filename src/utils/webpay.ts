import type { PaymentSession } from '../api/client';

declare global {
  interface Window {
    webpayCheckout?: (request: Record<string, unknown>) => void;
  }
}

export async function ensureWebpayScript(src: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.webpayCheckout) return;
  const hit = document.querySelector(`script[data-kolet-webpay="1"]`);
  if (hit && (hit as HTMLScriptElement).src === src && window.webpayCheckout) return;

  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.dataset.koletWebpay = '1';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Interswitch inline checkout'));
    document.body.appendChild(s);
  });
}

export async function openInlineCheckout(
  session: PaymentSession,
  scriptUrl: string,
  onComplete: (response: unknown) => void
): Promise<void> {
  await ensureWebpayScript(scriptUrl);
  const checkout = window.webpayCheckout;
  if (!checkout) {
    throw new Error('webpayCheckout is not available after loading script');
  }

  const req: Record<string, unknown> = {
    merchant_code: session.merchant_code,
    pay_item_id: session.pay_item_id,
    txn_ref: session.txn_ref,
    site_redirect_url: session.site_redirect_url,
    amount: session.amount,
    currency: session.currency,
    cust_email: session.cust_email,
    cust_name: session.cust_name || 'Kolet Pay customer',
    pay_item_name: session.pay_item_name,
    mode: session.mode,
    onComplete,
  };

  if (session.access_token) {
    req.access_token = session.access_token;
  }

  checkout(req);
}
