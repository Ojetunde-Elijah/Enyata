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
  nairaToKoboString,
  createVirtualWallet,
  executePayout
} from './interswitch.js';
import {
  hashPassword,
  maskClientId,
  newSessionToken,
  readWorkspace,
  verifyPassword,
  writeWorkspace,
  WORKSPACE_VERSION,
} from './workspaceStore.js';

function bad(res, status, msg) {
  res.status(status).json({ error: msg });
}

// normalizeInter removed as we no longer take interswitch config from client payload
export function registerApiRoutes(app) {
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/setup/status', async (_req, res) => {
    const w = await readWorkspace();
    res.json({ hasWorkspace: Boolean(w) });
  });

  app.post('/api/auth/signup', async (req, res) => {
    if (await readWorkspace()) {
      bad(res, 409, 'Workspace already exists. Sign in instead.');
      return;
    }

    const b = req.body || {};
    const email = String(b.email ?? '').trim().toLowerCase();
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

    await writeWorkspace(data);
    res.json({ token: sessionToken });
  });


  app.post('/api/auth/login', async (req, res) => {
    const w = await readWorkspace();
    if (!w) {
      return bad(res, 404, 'No workspace yet. Complete signup first.');
    }

    const b = req.body || {};
    const email = String(b.email ?? '').trim().toLowerCase();
    const password = String(b.password ?? '');

    if (email !== w.email || !verifyPassword(password, w.passwordHash)) {
      return bad(res, 401, 'Invalid email or password.');
    }

    w.sessionToken = newSessionToken();
    await writeWorkspace(w);
    res.json({ token: w.sessionToken });
  });

  const authed = express.Router();
  authed.use(authMiddleware);

  authed.get('/public-config', (req, res) => {
    const { workspace } = req;
    const inter = workspace.profile.interswitch;
    const urls = paymentUrlsForMode(inter.mode);
    const ready = assertInterswitchReady(inter).ok;
    res.json({
      merchantCode: inter.merchantCode,
      payItemId: inter.payItemId,
      currencyNumeric: serverConfig.currencyNumeric,
      mode: inter.mode,
      tillAlias: inter.tillAlias || null,
      inlineCheckoutScriptUrl: urls.inlineCheckoutScriptUrl,
      publicAppUrl: serverConfig.publicAppUrl,
      paymentEnvReady: ready,
    });
  });

  authed.get('/merchant-profile', (req, res) => {
    const { workspace } = req;
    const p = workspace.profile;
    const inter = p.interswitch;
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
    const check = assertInterswitchReady(workspace.profile.interswitch);
    if (check.ok === false) {
      return bad(res, 400, `Missing Interswitch fields: ${check.missing.join(', ')}`);
    }

    await writeWorkspace(workspace);
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
        const details = await getWalletDetails(workspace.profile.interswitch, workspace.profile.mobileNo);
        if (details && details.virtualAccount) {
          workspace.profile.virtualWallet = details;
          await writeWorkspace(workspace);
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

    const inv = {
      id: `INV-${Date.now()}`,
      customer,
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      amount,
      status: st,
      items,
    };

    workspace.invoices.unshift(inv);
    await writeWorkspace(workspace);
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
    const inter = workspace.profile.interswitch;
    const check = assertInterswitchReady(inter);
    if (check.ok === false) {
      return res.status(503).json({ error: 'Payment not configured', missing: check.missing });
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
    const amountKobo = nairaToKoboString(amountNaira);
    const site_redirect_url = `${serverConfig.publicAppUrl.replace(/\/$/, '')}/dashboard`;

    let access_token;
    try {
      const tok = await fetchPassportAccessToken(inter);
      access_token = tok.access_token;
    } catch {
      // Optional for some widget flows
    }

    res.json({
      txn_ref,
      merchant_code: inter.merchantCode,
      pay_item_id: inter.payItemId,
      amount: amountKobo,
      currency: serverConfig.currencyNumeric,
      mode: inter.mode,
      site_redirect_url,
      cust_email: custEmail,
      cust_name: typeof body.custName === 'string' ? body.custName : '',
      pay_item_name: typeof body.payItemName === 'string' && body.payItemName ? body.payItemName : 'Kolet Pay invoice',
      access_token,
    });
  });

  authed.get('/payments/verify', async (req, res) => {
    const { workspace } = req;
    const inter = workspace.profile.interswitch;
    const check = assertInterswitchReady(inter);
    if (check.ok === false) {
      return res.status(503).json({ error: 'Payment not configured', missing: check.missing });
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
    const inter = workspace.profile.interswitch;
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
