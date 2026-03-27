import express from 'express';
import { serverConfig, paymentUrlsForMode, interswitchConfig, apiMarketConfig } from './config.js';
import { computeDashboard, computeInventorySummary } from './metrics.js';
import { authMiddleware } from './authMiddleware.js';
import { runKYCChecks } from './apiMarket.js';

import {
  assertInterswitchReady,
  fetchPassportAccessToken,
  getTransactionJson,
  makeTxnRef,
  nairaToKobo,
  createVirtualWallet,
  executePayout
} from './interswitch.js';
import {
  readUser,
  writeUser,
  saveSession,
  getUserBySession,
  hashPassword,
  verifyPassword,
  newSessionToken,
  maskClientId,
  WORKSPACE_VERSION,
  ensureDataDir,
  getUserByInvoice,
  saveInvoiceIndex
} from './workspaceStore.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

function bad(res, status, msg) {
  res.status(status).json({ error: msg });
}

// normalizeInter removed as we no longer take interswitch config from client payload
export function registerApiRoutes(app) {
  app.use(express.json());

  // --- Public Payment Link APIs ---

  app.get('/public/invoice/:invoiceId', async (req, res) => {
    const { invoiceId } = req.params;

    // We need to find which user this invoice belongs to.
    // We'll use a global index for this.
    const ownerEmail = await getUserByInvoice(invoiceId);
    if (!ownerEmail) return res.status(404).json({ error: 'Invoice not found' });

    const ws = await readUser(ownerEmail);
    if (!ws) return res.status(404).json({ error: 'Merchant not found' });

    const inv = ws.invoices.find(i => i.id === invoiceId);
    if (inv) {
      return res.json({
        invoice: inv,
        businessName: ws.profile.businessLegalName || ws.profile.fullName || 'Merchant',
        merchantCode: interswitchConfig.merchantCode,
      });
    }
    res.status(404).json({ error: 'Invoice not found' });
  });

  app.post('/public/payments/session', async (req, res) => {
    const { invoiceId, custEmail } = req.body;
    if (!invoiceId || !custEmail) {
      return bad(res, 400, 'invoiceId and custEmail are required');
    }

    const ownerEmail = await getUserByInvoice(invoiceId);
    if (!ownerEmail) return res.status(404).json({ error: 'Invoice not found' });

    const foundWs = await readUser(ownerEmail);
    const foundInv = foundWs?.invoices.find(i => i.id === invoiceId);
    if (!foundInv || !foundWs) {
      return res.status(404).json({ error: 'Invoice or Merchant not found' });
    }

    const inter = interswitchConfig; // Source from environment variables
    const check = assertInterswitchReady(inter);
    if (!check.ok) {
       return res.status(503).json({ error: 'Merchant is not configured for payments' });
    }

    const txn_ref = makeTxnRef();
    const amountKobo = nairaToKobo(foundInv.amount);
    const site_redirect_url = `${serverConfig.publicAppUrl.replace(/\/$/, '')}/pay/${invoiceId}/success`;

    let access_token = null;
    let payable_id = inter.payItemId;
    try {
      const tok = await fetchPassportAccessToken(inter);
      access_token = tok.access_token;
      if (tok.payable_id) payable_id = tok.payable_id;
    } catch (e) {
      console.warn(`[Public Payment] Token fetch failed: ${e.message}`);
    }

    res.json({
      txn_ref,
      merchant_code: inter.merchantCode,
      pay_item_id: payable_id,
      amount: amountKobo,
      currency: Number(serverConfig.currencyNumeric),
      mode: inter.mode,
      site_redirect_url,
      cust_email: custEmail,
      cust_name: foundInv.customerName,
      pay_item_name: `Invoice ${foundInv.number}`,
      access_token: inter.mode === 'LIVE' ? access_token : null,
    });
  });

  // --- End Public APIs ---

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/setup/status', async (_req, res) => {
    // In multi-user mode, we always want people to be able to sign up or log in.
    const isVercel = process.env.VERCEL === '1' || !!process.env.NOW_REGION;
    const hasRedis = typeof process.env.UPSTASH_REDIS_REST_URL === 'string' && process.env.UPSTASH_REDIS_REST_URL.trim() !== '';

    res.json({
      hasWorkspace: true, // Always show login/signup
      persistenceIssue: isVercel && !hasRedis ? 'Vercel requires Upstash Redis for session persistence.' : null
    });
  });

  app.post('/api/auth/signup', async (req, res) => {
    const b = req.body || {};
    const email = String(b.email ?? '').trim().toLowerCase();

    if (!email) return bad(res, 400, 'Email is required');
    if (await readUser(email)) {
      bad(res, 409, 'An account with this email already exists.');
      return;
    }
    const password = String(b.password ?? '');
    const businessLegalName = String(b.businessLegalName ?? '').trim();
    const registeredAddress = String(b.registeredAddress ?? '').trim();
    const mobileNo = String(b.mobileNo ?? '08000000000').trim();
    const firstName = String(b.firstName ?? 'Kolet').trim();
    const lastName = String(b.lastName ?? '').trim();
    const nin = String(b.nin ?? '').trim();
    const bvn = String(b.bvn ?? '').trim();
    const tin = String(b.tin ?? '').trim();
    const interswitch = interswitchConfig;
    const collectionBank = b.collectionBank || {};

    // ── Basic field validation ──────────────────────────────────────────────
    if (!email || !email.includes('@')) {
      return bad(res, 400, 'Valid email is required.');
    }
    if (password.length < 8) {
      return bad(res, 400, 'Password must be at least 8 characters.');
    }
    if (!businessLegalName) {
      return bad(res, 400, 'Legal business name is required.');
    }
    if (!registeredAddress) {
      return bad(res, 400, 'Registered address is required.');
    }
    if (!firstName) {
      return bad(res, 400, 'First name (owner) is required.');
    }
    if (!lastName) {
      return bad(res, 400, 'Last name (owner) is required.');
    }
    if (!/^\d{11}$/.test(nin)) {
      return bad(res, 400, 'NIN must be exactly 11 digits.');
    }
    if (!/^\d{11}$/.test(bvn)) {
      return bad(res, 400, 'BVN must be exactly 11 digits.');
    }

    // ── API Marketplace KYC verification ───────────────────────────────────
    let kycResults = {};
    try {
      kycResults = await runKYCChecks(apiMarketConfig, { firstName, lastName, nin, bvn, tin });
    } catch (e) {
      console.error('KYC verification error:', e.message);
      return bad(res, 422, e.message);
    }

    const sessionToken = newSessionToken();
    const data = {
      version: WORKSPACE_VERSION,
      email,
      passwordHash: hashPassword(password),
      sessionToken,
      profile: {
        businessLegalName,
        registeredAddress,
        mobileNo,
        firstName,
        lastName,
        kyc: {
          nin: nin.replace(/.(?=.{4})/g, '*'),
          bvn: bvn.replace(/.(?=.{4})/g, '*'),
          tin: tin || null,
          verifiedAt: new Date().toISOString(),
        },
        interswitch,
        virtualWallet: null,
        collectionBank
      },
      invoices: [],
      products: [],
      customers: [],
    };

    await writeUser(data);
    await saveSession(sessionToken, email);
    res.json({ token: sessionToken });
  });


  app.post('/api/auth/login', async (req, res) => {
    const b = req.body || {};
    const email = String(b.email ?? '').trim().toLowerCase();
    const password = String(b.password ?? '');

    const w = await readUser(email);
    if (!w) {
      return bad(res, 404, 'No account found with this email.');
    }

    if (!verifyPassword(password, w.passwordHash)) {
      return bad(res, 401, 'Invalid email or password.');
    }

    const sessionToken = newSessionToken();
    await saveSession(sessionToken, email);
    res.json({ token: sessionToken });
  });

  async function authMiddleware(req, res, next) {
    const auth = req.headers.authorization || '';
    const token = auth.replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ error: 'Auth required' });

    const user = await getUserBySession(token);
    if (!user) return res.status(401).json({ error: 'Invalid or expired session' });
    req.workspace = user;
    next();
  }

  const authed = express.Router();
  authed.use(authMiddleware);

  authed.get('/public-config', (req, res) => {
    const inter = interswitchConfig;
    const urls = paymentUrlsForMode(inter.mode);
    const check = assertInterswitchReady(inter);

    // Log for Vercel console troubleshooting (masked)
    console.log(`[Config Check] Merchant: ${inter.merchantCode || 'MISSING'}, PayItem: ${inter.payItemId || 'MISSING'}, ClientID: ${maskClientId(inter.clientId)}, Secret: ${inter.secretKey ? 'PRESENT' : 'MISSING'}`);

    res.json({
      merchantCode: inter.merchantCode,
      payItemId: inter.payItemId,
      currencyNumeric: serverConfig.currencyNumeric,
      mode: inter.mode,
      tillAlias: inter.tillAlias || null,
      inlineCheckoutScriptUrl: urls.inlineCheckoutScriptUrl,
      publicAppUrl: serverConfig.publicAppUrl,
      paymentEnvReady: check.ok,
      missingFields: check.ok ? [] : check.missing // Help user see what's missing
    });
  });

  authed.get('/merchant-profile', (req, res) => {
    const { workspace } = req;
    const p = workspace.profile;
    const inter = interswitchConfig; // Source from environment variables
    res.json({
      legalBusinessName: p.businessLegalName,
      registeredAddress: p.registeredAddress,
      merchantCode: inter.merchantCode,
      payItemId: inter.payItemId,
      tillAlias: inter.tillAlias || null,
      integrationMode: inter.mode,
      hasDataRefConfigured: Boolean(inter.dataRef.trim()),
      clientIdMasked: maskClientId(inter.clientId),
      hasClientSecret: Boolean(inter.secretKey.trim()),
      virtualWallet: p.virtualWallet || null,
      collectionBank: p.collectionBank || null,
      masterWalletId: inter.masterWalletId || null
    });
  });

  authed.post('/settings', async (req, res) => {
    const { workspace } = req;
    const b = req.body || {};

    if (typeof b.businessLegalName === 'string' && b.businessLegalName.trim()) {
      workspace.profile.businessLegalName = b.businessLegalName.trim();
    }
    if (typeof b.registeredAddress === 'string' && b.registeredAddress.trim()) {
      workspace.profile.registeredAddress = b.registeredAddress.trim();
    }
    if (b.collectionBank) {
      workspace.profile.collectionBank = b.collectionBank;
    }

    // Interswitch fields are strictly managed by the backend through environment variables.
    // We no longer update them from the frontend settings payload.
    const check = assertInterswitchReady(interswitchConfig);
    if (check.ok === false) {
      return bad(res, 400, `Platform Interswitch credentials are incomplete: ${check.missing.join(', ')}`);
    }

    await writeUser(workspace);
    res.json({ ok: true });
  });

  authed.get('/stats', (req, res) => {
    const { workspace } = req;
    const dash = computeDashboard(workspace.invoices, workspace.products);
    res.json({
      revenue: dash.stats.revenueNaira,
      outstanding: dash.stats.outstandingNaira,
      successRate: dash.stats.successRatePercent,
    });
  });

  authed.get('/dashboard', async (req, res) => {
    const { workspace } = req;

    // Automatic Background Recovery for "envelope" responses
    if (workspace.profile.virtualWallet?.responseDescription === 'true' &&
        !workspace.profile.virtualWallet.virtualAccount &&
        workspace.profile.mobileNo) {
      console.log("Dashboard detected missing account. Attempting background recovery...");
      try {
        const details = await getWalletDetails(interswitchConfig, workspace.profile.mobileNo);
        if (details && details.virtualAccount) {
          workspace.profile.virtualWallet = details;
          await writeUser(workspace);
        }
      } catch (e) {
        console.warn("Background recovery failed:", e.message);
      }
    }

    const dash = computeDashboard(workspace.invoices, workspace.products);
    res.json({
      ...dash,
      virtualWallet: workspace.profile.virtualWallet || null
    });
  });

  authed.get('/invoices', (req, res) => {
    res.json(req.workspace.invoices);
  });

  authed.post('/invoices', async (req, res) => {
    const { workspace } = req;
    const b = req.body || {};

    const customer = String(b.customer ?? '').trim();
    const amount = typeof b.amount === 'number' ? b.amount : Number(b.amount);
    if (!customer || !Number.isFinite(amount) || amount <= 0) {
      return bad(res, 400, 'customer and positive amount are required');
    }

    const status = b.status ?? 'Pending';
    const allowed = ['Paid', 'Pending', 'Overdue'];
    const st = allowed.includes(status) ? status : 'Pending';
    const items = typeof b.items === 'number' && b.items > 0 ? Math.floor(b.items) : 1;

    const id = `INV-${Date.now()}`;
    const inv = {
      id,
      customer,
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      amount,
      status: st,
      items,
      initials: (customer[0] || '?') + (customer[1] || '').toUpperCase(),
    };

    workspace.invoices.unshift(inv);
    await saveInvoiceIndex(id, workspace.email);
    await writeUser(workspace);
    res.json(inv);
  });

  authed.get('/products', (req, res) => {
    res.json(req.workspace.products);
  });

  authed.get('/customers', (req, res) => {
    res.json(req.workspace.customers);
  });

  authed.get('/inventory/summary', (req, res) => {
    const { workspace } = req;
    res.json(computeInventorySummary(workspace.products));
  });

  authed.post('/payments/session', async (req, res) => {
    const { workspace } = req;
    const inter = interswitchConfig; // Source from environment variables
    const check = assertInterswitchReady(inter);
    if (check.ok === false) {
      return res.status(503).json({ error: 'Merchant is not configured for payments', missing: check.missing });
    }

    const body = req.body || {};
    const amountNaira = typeof body.amountNaira === 'number' ? body.amountNaira : Number.NaN;
    if (!Number.isFinite(amountNaira) || amountNaira <= 0) {
      return bad(res, 400, 'amountNaira must be a positive number');
    }

    const custEmail = typeof body.custEmail === 'string' ? body.custEmail.trim() : '';
    if (!custEmail) {
      return bad(res, 400, 'custEmail is required for Web Checkout');
    }

    const txn_ref = makeTxnRef();
    const amountKobo = nairaToKobo(amountNaira);
    const site_redirect_url = `${serverConfig.publicAppUrl.replace(/\/$/, '')}/dashboard`;

    let access_token = null;
    let payable_id = inter.payItemId; // fallback
    try {
      const tok = await fetchPassportAccessToken(inter);
      access_token = tok.access_token;
      if (tok.payable_id) {
        payable_id = tok.payable_id;
        console.log(`[Payment] Using numeric payable_id from token: ${payable_id}`);
      }
    } catch (e) {
      console.warn(`[Payment] Token fetch failed, defaulting to ${payable_id}`, e.message);
    }

    res.json({
      txn_ref,
      merchant_code: inter.merchantCode,
      pay_item_id: payable_id,
      amount: amountKobo,
      currency: Number(serverConfig.currencyNumeric), // ensure numeric
      mode: inter.mode,
      site_redirect_url,
      cust_email: custEmail,
      cust_name: typeof body.custName === 'string' ? body.custName : '',
      pay_item_name: typeof body.payItemName === 'string' && body.payItemName ? body.payItemName : 'Kolet Pay invoice',
      // Some sandbox merchants conflict with the access_token in the inline script
      access_token: inter.mode === 'LIVE' ? access_token : null,
    });
  });

  authed.get('/payments/verify', async (req, res) => {
    const inter = interswitchConfig; // Source from environment variables
    const check = assertInterswitchReady(inter);
    if (check.ok === false) {
      return res.status(503).json({ error: 'Payment context incomplete', missing: check.missing });
    }

    const txnref = typeof req.query.txnref === 'string' ? req.query.txnref.trim() : '';
    const amountRaw = typeof req.query.amount === 'string' ? req.query.amount.trim() : '';

    if (!txnref || !amountRaw) {
      return bad(res, 400, 'txnref and amount (kobo) are required');
    }

    try {
      const data = await getTransactionJson(inter, {
        merchantCode: inter.merchantCode,
        transactionReference: txnref,
        amountKobo: amountRaw,
      });
      res.json(data);
    } catch (e) {
      res.status(502).json({ error: e.message });
    }
  });

  authed.post('/withdraw', async (req, res) => {
    const { workspace } = req;
    const inter = interswitchConfig; // Source from environment variables
    const collectionBank = workspace.profile.collectionBank;

    if (!collectionBank || !collectionBank.accountNumber) {
       return bad(res, 400, "No collection bank configured for this account.");
    }

    const b = req.body || {};
    const amount = Number(b.amount) || 0;
    if (amount <= 0) {
       return bad(res, 400, "Amount must be greater than 0");
    }

    // Default to the provided Kolet master wallet ID if one is not bound.
    const masterWalletId = inter.masterWalletId || '2700013545';

    try {
      const resp = await executePayout(inter, {
         transactionReference: makeTxnRef('PO'),
         payoutChannel: "BANK_TRANSFER",
         currencyCode: "NGN",
         amount: amount,
         narration: "Withdrawal to " + (collectionBank.accountName || 'Business Account'),
         sourceAccountName: workspace.profile.businessLegalName || "Kolet Pay",
         sourceAccountNumber: masterWalletId,
         walletDetails: {
           pin: "1234",
           walletId: masterWalletId
         },
         recipient: {
           recipientAccount: collectionBank.accountNumber,
           recipientBank: collectionBank.bankCode || "044", // Fallback code if not provided
           currencyCode: "NGN"
         },
         singleCall: true
      });
      res.json(resp);
    } catch(e) {
      res.status(502).json({ error: e.message });
    }
  });

  app.use('/api', authed);
}
