import express, { type Express, type Response } from 'express';
import type { Invoice } from '../src/types.ts';
import { serverConfig, paymentUrlsForMode } from './config.ts';
import { computeDashboard, computeInventorySummary } from './metrics.ts';
import { authMiddleware, type AuthedRequest } from './authMiddleware.ts';
import {
  assertInterswitchReady,
  fetchPassportAccessToken,
  getTransactionJson,
  makeTxnRef,
  nairaToKoboString,
} from './interswitch.ts';
import {
  hashPassword,
  maskClientId,
  newSessionToken,
  readWorkspace,
  verifyPassword,
  writeWorkspace,
  WORKSPACE_VERSION,
  type WorkspaceData,
  type WorkspaceInterswitch,
} from './workspaceStore.ts';

function bad(res: Response, status: number, msg: string): void {
  res.status(status).json({ error: msg });
}

function normalizeInter(raw: Partial<Record<keyof WorkspaceInterswitch, unknown>>): WorkspaceInterswitch {
  const mode = raw.mode === 'LIVE' ? 'LIVE' : 'TEST';
  return {
    merchantCode: String(raw.merchantCode ?? '').trim(),
    payItemId: String(raw.payItemId ?? '').trim(),
    clientId: String(raw.clientId ?? '').trim(),
    secretKey: String(raw.secretKey ?? '').trim(),
    mode,
    tillAlias: String(raw.tillAlias ?? '').trim(),
    dataRef: String(raw.dataRef ?? '').trim(),
  };
}

export function registerApiRoutes(app: Express): void {
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

    const b = req.body as Partial<{
      email: string;
      password: string;
      businessLegalName: string;
      registeredAddress: string;
      interswitch: Partial<WorkspaceInterswitch>;
    }>;

    const email = String(b.email ?? '')
      .trim()
      .toLowerCase();
    const password = String(b.password ?? '');
    const businessLegalName = String(b.businessLegalName ?? '').trim();
    const registeredAddress = String(b.registeredAddress ?? '').trim();
    const interswitch = normalizeInter((b.interswitch ?? {}) as Partial<WorkspaceInterswitch>);

    if (!email || !email.includes('@')) {
      bad(res, 400, 'Valid email is required.');
      return;
    }
    if (password.length < 8) {
      bad(res, 400, 'Password must be at least 8 characters.');
      return;
    }
    if (!businessLegalName) {
      bad(res, 400, 'Legal business name is required.');
      return;
    }
    if (!registeredAddress) {
      bad(res, 400, 'Registered address is required.');
      return;
    }

    const check = assertInterswitchReady(interswitch);
    if (check.ok === false) {
      bad(res, 400, `Missing Interswitch fields: ${check.missing.join(', ')}`);
      return;
    }

    const sessionToken = newSessionToken();
    const data: WorkspaceData = {
      version: WORKSPACE_VERSION,
      email,
      passwordHash: hashPassword(password),
      sessionToken,
      profile: {
        businessLegalName,
        registeredAddress,
        interswitch,
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
      bad(res, 404, 'No workspace yet. Complete signup first.');
      return;
    }

    const b = req.body as Partial<{ email: string; password: string }>;
    const email = String(b.email ?? '')
      .trim()
      .toLowerCase();
    const password = String(b.password ?? '');

    if (email !== w.email || !verifyPassword(password, w.passwordHash)) {
      bad(res, 401, 'Invalid email or password.');
      return;
    }

    w.sessionToken = newSessionToken();
    await writeWorkspace(w);
    res.json({ token: w.sessionToken });
  });

  const authed = express.Router();
  authed.use(authMiddleware);

  authed.get('/public-config', (req, res) => {
    const { workspace } = req as AuthedRequest;
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
    const { workspace } = req as AuthedRequest;
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
    });
  });

  authed.post('/settings', async (req, res) => {
    const { workspace } = req as AuthedRequest;
    const b = req.body as Partial<{
      businessLegalName: string;
      registeredAddress: string;
      interswitch: Partial<WorkspaceInterswitch & { secretKey?: string }>;
    }>;

    if (typeof b.businessLegalName === 'string' && b.businessLegalName.trim()) {
      workspace.profile.businessLegalName = b.businessLegalName.trim();
    }
    if (typeof b.registeredAddress === 'string' && b.registeredAddress.trim()) {
      workspace.profile.registeredAddress = b.registeredAddress.trim();
    }

    if (b.interswitch && typeof b.interswitch === 'object') {
      const cur = workspace.profile.interswitch;
      const incoming = b.interswitch;
      if (typeof incoming.merchantCode === 'string') cur.merchantCode = incoming.merchantCode.trim();
      if (typeof incoming.payItemId === 'string') cur.payItemId = incoming.payItemId.trim();
      if (typeof incoming.clientId === 'string') cur.clientId = incoming.clientId.trim();
      if (typeof incoming.secretKey === 'string' && incoming.secretKey.trim()) {
        cur.secretKey = incoming.secretKey.trim();
      }
      if (incoming.mode === 'LIVE' || incoming.mode === 'TEST') cur.mode = incoming.mode;
      if (typeof incoming.tillAlias === 'string') cur.tillAlias = incoming.tillAlias.trim();
      if (typeof incoming.dataRef === 'string' && incoming.dataRef.trim()) {
        cur.dataRef = incoming.dataRef.trim();
      }
    }

    const check = assertInterswitchReady(workspace.profile.interswitch);
    if (check.ok === false) {
      bad(res, 400, `Missing Interswitch fields: ${check.missing.join(', ')}`);
      return;
    }

    await writeWorkspace(workspace);
    res.json({ ok: true });
  });

  authed.get('/stats', (req, res) => {
    const { workspace } = req as AuthedRequest;
    const dash = computeDashboard(workspace.invoices, workspace.products);
    res.json({
      revenue: dash.stats.revenueNaira,
      outstanding: dash.stats.outstandingNaira,
      successRate: dash.stats.successRatePercent,
    });
  });

  authed.get('/dashboard', (req, res) => {
    const { workspace } = req as AuthedRequest;
    res.json(computeDashboard(workspace.invoices, workspace.products));
  });

  authed.get('/invoices', (req, res) => {
    res.json((req as AuthedRequest).workspace.invoices);
  });

  authed.post('/invoices', async (req, res) => {
    const { workspace } = req as AuthedRequest;
    const b = req.body as Partial<{
      customer: string;
      amount: number;
      status: Invoice['status'];
      items: number;
    }>;

    const customer = String(b.customer ?? '').trim();
    const amount = typeof b.amount === 'number' ? b.amount : Number(b.amount);
    if (!customer || !Number.isFinite(amount) || amount <= 0) {
      bad(res, 400, 'customer and positive amount are required');
      return;
    }

    const status = (b.status ?? 'Pending') as Invoice['status'];
    const allowed: Invoice['status'][] = ['Paid', 'Pending', 'Overdue'];
    const st = allowed.includes(status) ? status : 'Pending';
    const items = typeof b.items === 'number' && b.items > 0 ? Math.floor(b.items) : 1;

    const inv: Invoice = {
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
    res.json((req as AuthedRequest).workspace.products);
  });

  authed.get('/customers', (req, res) => {
    res.json((req as AuthedRequest).workspace.customers);
  });

  authed.get('/inventory/summary', (req, res) => {
    const { workspace } = req as AuthedRequest;
    res.json(computeInventorySummary(workspace.products));
  });

  authed.post('/payments/session', async (req, res) => {
    const { workspace } = req as AuthedRequest;
    const inter = workspace.profile.interswitch;
    const check = assertInterswitchReady(inter);
    if (check.ok === false) {
      res.status(503).json({ error: 'Payment not configured', missing: check.missing });
      return;
    }

    const body = req.body as Partial<{
      amountNaira: number;
      custEmail: string;
      custName: string;
      payItemName: string;
    }>;

    const amountNaira = typeof body.amountNaira === 'number' ? body.amountNaira : Number.NaN;
    if (!Number.isFinite(amountNaira) || amountNaira <= 0) {
      bad(res, 400, 'amountNaira must be a positive number');
      return;
    }

    const custEmail = typeof body.custEmail === 'string' ? body.custEmail.trim() : '';
    if (!custEmail) {
      bad(res, 400, 'custEmail is required for Web Checkout');
      return;
    }

    const txn_ref = makeTxnRef();
    const amountKobo = nairaToKoboString(amountNaira);
    const site_redirect_url = `${serverConfig.publicAppUrl.replace(/\/$/, '')}/dashboard`;

    let access_token: string | undefined;
    try {
      const tok = await fetchPassportAccessToken(inter);
      access_token = tok.access_token;
    } catch {
      /* Optional for some widget flows */
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
      pay_item_name:
        typeof body.payItemName === 'string' && body.payItemName
          ? body.payItemName
          : 'Kolet Pay invoice',
      access_token,
    });
  });

  authed.get('/payments/verify', async (req, res) => {
    const { workspace } = req as AuthedRequest;
    const inter = workspace.profile.interswitch;
    const check = assertInterswitchReady(inter);
    if (check.ok === false) {
      res.status(503).json({ error: 'Payment not configured', missing: check.missing });
      return;
    }

    const txnref = typeof req.query.txnref === 'string' ? req.query.txnref.trim() : '';
    const amountRaw = typeof req.query.amount === 'string' ? req.query.amount.trim() : '';

    if (!txnref || !amountRaw) {
      bad(res, 400, 'txnref and amount (kobo) are required');
      return;
    }

    try {
      const data = await getTransactionJson(inter, {
        merchantCode: inter.merchantCode,
        transactionReference: txnref,
        amountKobo: amountRaw,
      });
      res.json(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(502).json({ error: message });
    }
  });

  app.use('/api', authed);
}
