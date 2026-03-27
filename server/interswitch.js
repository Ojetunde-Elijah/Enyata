import https from 'https';
import { paymentUrlsForMode } from './config.js';

function callInterswitchAPI(urlStr, options, label, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      return reject(new Error(`${label}: Too many redirects`));
    }

    let url;
    try {
      url = new URL(urlStr);
    } catch (e) {
      return reject(new Error(`${label}: Invalid URL ${urlStr}`));
    }

    const sanitizedHeaders = { ...options.headers };
    if (sanitizedHeaders.Authorization) {
      const auth = sanitizedHeaders.Authorization;
      sanitizedHeaders.Authorization = auth.startsWith('Basic ') ? 'Basic [MASKED]' : 'Bearer [MASKED]';
    }

    console.log(`\n--- [INTERSWITCH REQUEST: ${label}] ---`);
    console.log(`URL: ${urlStr}`);
    console.log(`Method: ${options.method || 'GET'}`);
    console.log(`Headers:`, JSON.stringify(sanitizedHeaders, null, 2));
    if (options.body) console.log(`Body:`, options.body);

    const headers = {
      'Accept': 'application/json',
      'User-Agent': 'PostmanRuntime/7.26.8',
      ...(options.headers || {}),
    };

    if (options.body) {
      headers['Content-Length'] = Buffer.byteLength(options.body);
    }

    const reqOptions = {
      method: options.method || 'GET',
      headers,
      timeout: 30000,
      // Allow TLSv1.2 and TLSv1.3 — restricting to only TLSv1.2 causes ECONNRESET
      // on servers that prefer TLSv1.3
      minVersion: 'TLSv1.2',
    };

    const attemptRequest = (retryLeft) => {
      const req = https.request(url, reqOptions, (res) => {
        // Handle Redirects
        if ([301, 302, 307, 308].includes(res.statusCode)) {
          let location = res.headers.location;
          console.log(`\n--- [INTERSWITCH REDIRECT: ${label}] (${res.statusCode}) ---`);
          console.log(`Target: ${location}`);
          
          if (location) {
            if (location.startsWith('http://')) {
              console.log(`Warning: Forcing insecure redirect back to HTTPS`);
              location = location.replace('http://', 'https://');
            }
            resolve(callInterswitchAPI(location, options, label, redirectCount + 1));
            return;
          }
        }

        let dataChunks = '';
        res.on('data', (chunk) => { dataChunks += chunk; });
        res.on('end', () => {
          console.log(`\n--- [INTERSWITCH RESPONSE: ${label}] (${res.statusCode}) ---`);
          let parsed = null;
          try {
            parsed = JSON.parse(dataChunks);
            console.log(`Body:`, JSON.stringify(parsed, null, 2));
          } catch (e) {
            console.log(`Body: ${dataChunks}`);
          }

          const isActuallySuccess = (res.statusCode >= 200 && res.statusCode < 300) || 
                                   (parsed && (parsed.responseDescription === 'true' || parsed.responseCode === '00'));

          if (isActuallySuccess) {
            resolve(parsed || dataChunks);
          } else {
            console.error(`Error Body:`, dataChunks);
            reject(new Error(`${label} failed: ${res.statusCode} ${dataChunks}`));
          }
        });
      });

      req.on('error', (err) => {
        const isRetryable = ['ECONNRESET', 'ECONNABORTED', 'EPIPE'].includes(err.code);
        if (isRetryable && retryLeft > 0) {
          console.warn(`\n--- [INTERSWITCH RETRY: ${label}] (${err.code}) retrying... ---`);
          setTimeout(() => attemptRequest(retryLeft - 1), 1500);
          return;
        }
        console.error(`\n--- [INTERSWITCH NETWORK ERROR: ${label}] ---`);
        console.error(`Reason: ${err.message}`);
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`${label} request timed out`));
      });

      if (options.body) req.write(options.body);
      req.end();
    };

    attemptRequest(1); // 1 retry allowed
  });
}

export async function fetchPassportAccessToken(inter) {
  const { passportUrl } = paymentUrlsForMode(inter.mode);
  const { clientId, secretKey } = inter;

  if (!clientId || !secretKey) {
    throw new Error('Client ID and secret are required (complete signup / Settings → Interswitch).');
  }

  const basic = Buffer.from(`${clientId}:${secretKey}`, 'utf8').toString('base64');
  const url = passportUrl.includes('?') ? passportUrl : `${passportUrl}?grant_type=client_credentials`;

  return callInterswitchAPI(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=profile',
  }, 'Passport Token');
}

export async function getTransactionJson(inter, params) {
  const { collectionsBase } = paymentUrlsForMode(inter.mode);
  const base = collectionsBase.replace(/\/$/, '');
  const u = new URL(`${base}/gettransaction.json`);
  u.searchParams.set('merchantcode', params.merchantCode);
  u.searchParams.set('transactionreference', params.transactionReference);
  u.searchParams.set('amount', params.amountKobo);

  return callInterswitchAPI(u.toString(), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  }, 'GetTransaction');
}

export async function getWalletDetails(inter, mobileNo) {
  const tokenList = await fetchPassportAccessToken(inter);
  const { apiBase } = paymentUrlsForMode(inter.mode);
  const url = `${apiBase}/api/v1/wallet/details/${inter.merchantCode}?mobileNo=${mobileNo}`;

  return callInterswitchAPI(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${tokenList.access_token}`
    }
  }, 'Get Wallet Details');
}

export async function createVirtualWallet(inter, payload) {
  const tokenList = await fetchPassportAccessToken(inter);
  const { apiBase } = paymentUrlsForMode(inter.mode);
  const url = `${apiBase}/api/v1/wallets`;

  const wallet = await callInterswitchAPI(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenList.access_token}`
    },
    body: JSON.stringify({
      merchantCode: inter.merchantCode,
      status: 'ACTIVE',
      provider: 'PRIME',
      ...payload
    })
  }, 'Wallet Creation');

  // If the response is just {"responseDescription": "true"} without account details,
  // we attempt to recover the full details using the mobile number.
  if (wallet.responseDescription === 'true' && !wallet.virtualAccount && payload.mobileNo) {
    console.log("Creation success but account missing. Attempting recovery for:", payload.mobileNo);
    try {
      const details = await getWalletDetails(inter, payload.mobileNo);
      if (details && details.virtualAccount) {
        return details;
      }
    } catch (e) {
      console.warn("Wallet recovery failed:", e.message);
    }
  }

  return wallet;
}

export async function executePayout(inter, payload) {
  const tokenList = await fetchPassportAccessToken(inter);
  const { apiBase } = paymentUrlsForMode(inter.mode);
  const url = `${apiBase}/api/v1/payouts`;

  return callInterswitchAPI(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenList.access_token}`
    },
    body: JSON.stringify(payload)
  }, 'Payout');
}


export function nairaToKobo(naira) {
  return Math.round(naira * 100);
}

export function makeTxnRef(prefix = 'KP') {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

export function assertInterswitchReady(inter) {
  const missing = [];
  if (!inter.merchantCode?.trim()) missing.push('merchantCode');
  if (!inter.payItemId?.trim()) missing.push('payItemId');
  if (!inter.clientId?.trim()) missing.push('clientId');
  if (!inter.secretKey?.trim()) missing.push('secretKey');
  if (missing.length) return { ok: false, missing };
  return { ok: true };
}
