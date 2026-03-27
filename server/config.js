function env(name, fallback) {
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

export function paymentUrlsForMode(mode) {
  if (mode === 'LIVE') {
    return {
      passportUrl: 'https://passport.interswitchng.com/passport/oauth/token',
      collectionsBase: 'https://webpay.interswitchng.com/collections/api/v1',
      inlineCheckoutScriptUrl: 'https://newwebpay.interswitchng.com/inline-checkout.js',
      apiBase: 'https://api.interswitchng.com'
    };
  }
  return {
    passportUrl: 'https://qa.interswitchng.com/passport/oauth/token',
    collectionsBase: 'https://qa.interswitchng.com/collections/api/v1',
    inlineCheckoutScriptUrl: 'https://newwebpay.qa.interswitchng.com/inline-checkout.js',
    apiBase: 'https://qa.interswitchng.com/collections'
  };
}

console.log(process.env.INTERSWITCH_MERCHANT_CODE);
console.log(process.env.INTERSWITCH_PAY_ITEM_ID);
console.log(process.env.INTERSWITCH_CLIENT_ID);
console.log(process.env.INTERSWITCH_SECRET_KEY);
console.log(process.env.INTERSWITCH_MODE);
console.log(process.env.INTERSWITCH_MASTER_WALLET_ID);
console.log(process.env.INTERSWITCH_TILL_ALIAS);
console.log(process.env.INTERSWITCH_DATA_REF);

export const interswitchConfig = {
  merchantCode: process.env.INTERSWITCH_MERCHANT_CODE || '',
  payItemId: process.env.INTERSWITCH_PAY_ITEM_ID || '',
  clientId: process.env.INTERSWITCH_CLIENT_ID || '',
  secretKey: process.env.INTERSWITCH_SECRET_KEY || '',
  mode: process.env.INTERSWITCH_MODE === 'LIVE' ? 'LIVE' : 'TEST',
  masterWalletId: process.env.INTERSWITCH_MASTER_WALLET_ID || '',
  tillAlias: process.env.INTERSWITCH_TILL_ALIAS || '',
  dataRef: process.env.INTERSWITCH_DATA_REF || '',
};

/**
 * API Marketplace config for KYC verification (NIN / BVN / TIN).
 * The passportUrl here uses the specific Passport v2 host from the Postman collection's
 * "Auth Token" request (passport-v2.k8.isw.la), separate from the Interswitch payment passport.
 */
export const apiMarketConfig = {
  passportUrl: process.env.API_MARKET_PASSPORT_URL || 'https://passport-v2.k8.isw.la/passport/oauth/token',
  clientId: process.env.API_MARKET_CLIENT_ID || '',
  secretKey: process.env.API_MARKET_SECRET_KEY || '',
  baseURL: process.env.API_MARKET_BASE_URL || 'https://qa.interswitchng.com',
};
