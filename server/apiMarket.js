/**
 * Interswitch API Marketplace — KYC verification helpers.
 *
 * Endpoints used (from "All API Products" Postman collection):
 *   Auth Token  → POST   /passport/oauth/token  (client_credentials)
 *   Verify NIN  → POST   /marketplace-routing/api/v1/verify/identity/nin
 *   Verify BVN  → POST   /marketplace-routing/api/v1/verify/identity/bvn
 *   Verify TIN  → GET    /marketplace-routing/api/v1/verify/identity/tin?tin=...
 */

import https from 'https';

// ─── Low-level HTTP helper (mirrors the one in interswitch.js) ────────────────

function callApi(urlStr, options, label) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlStr);
    } catch {
      return reject(new Error(`[API MARKET] ${label}: invalid URL ${urlStr}`));
    }

    const sanitized = { ...(options.headers || {}) };
    if (sanitized.Authorization) {
      sanitized.Authorization = sanitized.Authorization.startsWith('Basic ')
        ? 'Basic [MASKED]'
        : 'Bearer [MASKED]';
    }

    console.log(`\n--- [API MARKET REQUEST: ${label}] ---`);
    console.log('URL:', urlStr);
    console.log('Method:', options.method || 'GET');
    console.log('Headers:', JSON.stringify(sanitized, null, 2));
    if (options.body) console.log('Body:', options.body);

    const headers = {
      Accept: 'application/json',
      'User-Agent': 'PostmanRuntime/7.26.8',
      ...(options.headers || {}),
    };
    if (options.body) {
      headers['Content-Length'] = Buffer.byteLength(options.body);
    }

    const req = https.request(
      url,
      {
        method: options.method || 'GET',
        headers,
        timeout: 20000,
        minVersion: 'TLSv1.2',
      },
      (res) => {
        // Follow redirects
        if ([301, 302, 307, 308].includes(res.statusCode)) {
          let loc = res.headers.location || '';
          if (loc.startsWith('http://')) loc = loc.replace('http://', 'https://');
          if (loc) return resolve(callApi(loc, options, label));
        }

        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          console.log(`\n--- [API MARKET RESPONSE: ${label}] (${res.statusCode}) ---`);
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
            console.log('Body:', JSON.stringify(parsed, null, 2));
          } catch {
            console.log('Body (raw):', raw);
          }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed ?? raw);
          } else {
            reject(new Error(`[API MARKET] ${label} failed: HTTP ${res.statusCode} — ${raw}`));
          }
        });
      },
    );

    req.on('error', (e) => {
      console.error(`\n--- [API MARKET NETWORK ERROR: ${label}] ---`);
      console.error('Reason:', e.message);
      reject(e);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`[API MARKET] ${label} request timed out`));
    });

    if (options.body) req.write(options.body);
    req.end();
  });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Obtain a bearer token from Passport using the API Marketplace client credentials.
 * Matches the "Auth Token" request in the Postman collection.
 */
export async function getApiMarketToken(cfg) {
  const { passportUrl, clientId, secretKey } = cfg;
  const basic = Buffer.from(`${clientId}:${secretKey}`, 'utf8').toString('base64');

  const data = await callApi(
    passportUrl,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=profile',
    },
    'Get Token',
  );

  if (!data?.access_token) {
    throw new Error('API Marketplace auth did not return an access_token');
  }
  return data.access_token;
}

// ─── KYC verifications ────────────────────────────────────────────────────────

/**
 * Verify NIN — matches "verifyMe NIN" in the Postman collection.
 * Test values: nin="63184876213", firstName="Bunch", lastName="Dillon"
 */
export async function verifyNIN(token, baseURL, { firstName, lastName, nin }) {
  const url = `${baseURL.replace(/\/$/, '')}/marketplace-routing/api/v1/verify/identity/nin`;
  const data = await callApi(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ firstName, lastName, nin }),
    },
    'Verify NIN',
  );
  return data;
}

/**
 * Verify BVN — matches "verifyme BVN" in the Postman collection.
 * Test values: bvn="95888168924", firstName="Bunch", lastName="Dillon"
 */
export async function verifyBVN(token, baseURL, { firstName, lastName, bvn }) {
  const url = `${baseURL.replace(/\/$/, '')}/marketplace-routing/api/v1/verify/identity/bvn`;
  const data = await callApi(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ firstName, lastName, bvn }),
    },
    'Verify BVN',
  );
  return data;
}

/**
 * Verify TIN — matches "verifyme TIN" in the Postman collection.
 * Test value: tin="08120451-1001"
 */
export async function verifyTIN(token, baseURL, tin) {
  const url = `${baseURL.replace(/\/$/, '')}/marketplace-routing/api/v1/verify/identity/tin?tin=${encodeURIComponent(tin)}`;
  const data = await callApi(
    url,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    'Verify TIN',
  );
  return data;
}

/**
 * Convenience: run NIN + BVN (+ optional TIN) verification in sequence.
 *
 * Behaviour:
 *  - If the KYC service is unreachable / returns 404 (wrong baseURL, service down)
 *    we log a warning and return a soft-pass so onboarding isn't blocked by infra issues.
 *    Set REQUIRE_KYC=true to make ALL errors hard-block.
 *  - If the service is reachable but explicitly rejects the data (4xx with a body
 *    that indicates identity mismatch) we always block regardless of REQUIRE_KYC.
 *
 * @param {object} cfg  API Marketplace config (passportUrl, clientId, secretKey, baseURL)
 * @param {object} kyc  { firstName, lastName, nin, bvn, tin? }
 * @returns {{ ninResult, bvnResult, tinResult?, skipped? }}
 */
export async function runKYCChecks(cfg, { firstName, lastName, nin, bvn, tin }) {
  const requireKyc = process.env.REQUIRE_KYC === 'true';

  // Helper: decide whether an error should hard-block or soft-skip
  function isInfraError(e) {
    const msg = e.message || '';
    // 404 = endpoint not found (wrong baseURL / service not deployed)
    // ECONNREFUSED / ENOTFOUND / timeout = network-level
    return (
      msg.includes('HTTP 404') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('timed out')
    );
  }

  let token;
  try {
    token = await getApiMarketToken(cfg);
  } catch (e) {
    if (!requireKyc && isInfraError(e)) {
      console.warn('[KYC] Token fetch failed (infra error) — skipping KYC:', e.message);
      return { skipped: true, reason: 'KYC service unreachable (token)' };
    }
    throw new Error(`KYC authentication failed. Check API_MARKET_* env vars. (${e.message})`);
  }

  let ninResult;
  try {
    ninResult = await verifyNIN(token, cfg.baseURL, { firstName, lastName, nin });
  } catch (e) {
    if (!requireKyc && isInfraError(e)) {
      console.warn('[KYC] NIN endpoint unreachable — skipping KYC:', e.message);
      console.warn('[KYC] Hint: set API_MARKET_BASE_URL to the correct Marketplace host.');
      return { skipped: true, reason: 'KYC service unreachable (NIN)' };
    }
    throw new Error(`NIN verification failed — please check the NIN and name you provided. (${e.message})`);
  }

  let bvnResult;
  try {
    bvnResult = await verifyBVN(token, cfg.baseURL, { firstName, lastName, bvn });
  } catch (e) {
    if (!requireKyc && isInfraError(e)) {
      console.warn('[KYC] BVN endpoint unreachable — skipping KYC:', e.message);
      return { skipped: true, reason: 'KYC service unreachable (BVN)' };
    }
    throw new Error(`BVN verification failed — please check the BVN and name you provided. (${e.message})`);
  }

  let tinResult = null;
  if (tin && tin.trim()) {
    try {
      tinResult = await verifyTIN(token, cfg.baseURL, tin.trim());
    } catch (e) {
      if (!requireKyc && isInfraError(e)) {
        console.warn('[KYC] TIN endpoint unreachable — skipping TIN check:', e.message);
      } else {
        throw new Error(`TIN verification failed — please check the TIN you provided. (${e.message})`);
      }
    }
  }

  return { ninResult, bvnResult, tinResult };
}
