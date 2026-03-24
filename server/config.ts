function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v != null && v !== '') return v;
  if (fallback !== undefined) return fallback;
  return '';
}

/** App URL for redirects (Web Checkout). Interswitch credentials come from workspace signup only. */
export const serverConfig = {
  publicAppUrl: env('PUBLIC_APP_URL', 'http://localhost:3000'),
  currencyNumeric: '566',
};

export function paymentUrlsForMode(mode: 'TEST' | 'LIVE'): {
  passportUrl: string;
  collectionsBase: string;
  inlineCheckoutScriptUrl: string;
} {
  if (mode === 'LIVE') {
    return {
      passportUrl: 'https://passport.interswitchng.com/passport/oauth/token',
      collectionsBase: 'https://webpay.interswitchng.com/collections/api/v1',
      inlineCheckoutScriptUrl: 'https://newwebpay.interswitchng.com/inline-checkout.js',
    };
  }
  return {
    passportUrl: 'https://qa.interswitchng.com/passport/oauth/token',
    collectionsBase: 'https://qa.interswitchng.com/collections/api/v1',
    inlineCheckoutScriptUrl: 'https://newwebpay.qa.interswitchng.com/inline-checkout.js',
  };
}
