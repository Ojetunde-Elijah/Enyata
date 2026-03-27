import type { Invoice, Product, Customer } from '../types';

const TOKEN_KEY = 'kolet_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export interface SignupPayload {
  email: string;
  password: string;
  businessLegalName: string;
  registeredAddress: string;
  mobileNo?: string;
  firstName?: string;
  lastName: string;
  nin: string;
  bvn: string;
  tin?: string;
  collectionBank?: {
    accountNumber: string;
    bankCode: string;
    accountName?: string;
  };
}


async function handleResponse<T>(res: Response, opts?: { auth?: boolean }): Promise<T> {
  if (res.status === 401 && opts?.auth && getToken()) {
    clearToken();
    window.location.assign('/login');
    throw new Error('Session expired');
  }
  const text = await res.text();
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = JSON.parse(text) as { error?: string; missing?: string[] };
      if (typeof j.error === 'string') msg = j.error;
      else if (Array.isArray(j.missing)) msg = `Missing: ${j.missing.join(', ')}`;
    } catch {
      if (text) msg = text;
    }
    throw new Error(msg);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const t = getToken();
  if (t) headers.set('Authorization', `Bearer ${t}`);
  return fetch(input, { ...init, headers });
}

export interface SetupStatus {
  hasWorkspace: boolean;
}

export async function getSetupStatus(): Promise<SetupStatus> {
  const res = await fetch('/api/setup/status');
  return handleResponse<SetupStatus>(res);
}

export async function signup(body: SignupPayload): Promise<{ token: string }> {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse<{ token: string }>(res);
}

export async function login(email: string, password: string): Promise<{ token: string }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse<{ token: string }>(res);
}

export interface PublicConfig {
  merchantCode: string;
  payItemId: string;
  currencyNumeric: string;
  mode: 'TEST' | 'LIVE';
  tillAlias: string | null;
  inlineCheckoutScriptUrl: string;
  publicAppUrl: string;
  paymentEnvReady: boolean;
}

export interface MerchantProfile {
  legalBusinessName: string;
  registeredAddress: string;
  merchantCode: string;
  payItemId: string;
  tillAlias: string | null;
  integrationMode: 'TEST' | 'LIVE';
  hasDataRefConfigured: boolean;
  clientIdMasked: string;
  hasClientSecret: boolean;
  virtualWallet: {
    walletId?: string;
    virtualAccount?: {
      accountNumber: string;
      bankName: string;
      bankCode: string;
      accountName: string;
    };
  } | null;
  collectionBank: { accountNumber: string; bankCode: string; accountName?: string } | null;
  masterWalletId: string | null;
}

export interface DashboardRecentInvoice {
  customer: string;
  amountNaira: number;
  amountFormatted: string;
  status: string;
  date: string;
  initials: string;
}

export interface DashboardPayload {
  stats: {
    revenueNaira: number;
    revenueFormatted: string;
    revenueTrendLabel: string;
    outstandingNaira: number;
    outstandingFormatted: string;
    overdueInvoiceCount: number;
    openInvoiceCount: number;
    successRatePercent: number;
    successRateFormatted: string;
  };
  recentInvoices: DashboardRecentInvoice[];
  salesTrendHeights: number[];
  salesTrendLabels: string[];
  payout: { nextDate: string; estimatedNaira: number; estimatedFormatted: string };
  virtualWallet: MerchantProfile['virtualWallet'];
}

export interface PaymentSession {
  txn_ref: string;
  merchant_code: string;
  pay_item_id: string;
  amount: string;
  currency: string;
  mode: 'TEST' | 'LIVE';
  site_redirect_url: string;
  cust_email: string;
  cust_name: string;
  pay_item_name: string;
  access_token?: string;
}

export interface InventorySummary {
  totalItems: number;
  lowStockCount: number;
  warehouseValueUsd: number;
  warehouseValueFormatted: string;
  categories: number;
  pageShown: { from: number; to: number; of: number };
}

export async function getPublicConfig(): Promise<PublicConfig> {
  const res = await authFetch('/api/public-config');
  return handleResponse<PublicConfig>(res, { auth: true });
}

export async function getMerchantProfile(): Promise<MerchantProfile> {
  const res = await authFetch('/api/merchant-profile');
  return handleResponse<MerchantProfile>(res, { auth: true });
}

export async function saveSettings(body: {
  businessLegalName?: string;
  registeredAddress?: string;
  collectionBank?: { accountNumber: string; bankCode: string; accountName?: string };

}): Promise<{ ok: boolean }> {
  const res = await authFetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse<{ ok: boolean }>(res, { auth: true });
}

export async function getDashboard(): Promise<DashboardPayload> {
  const res = await authFetch('/api/dashboard');
  return handleResponse<DashboardPayload>(res, { auth: true });
}

export async function getInvoices(): Promise<Invoice[]> {
  const res = await authFetch('/api/invoices');
  return handleResponse<Invoice[]>(res, { auth: true });
}

export async function createInvoice(body: {
  customer: string;
  amount: number;
  status?: Invoice['status'];
  items?: number;
}): Promise<Invoice> {
  const res = await authFetch('/api/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse<Invoice>(res, { auth: true });
}

export async function getProducts(): Promise<Product[]> {
  const res = await authFetch('/api/products');
  return handleResponse<Product[]>(res, { auth: true });
}

export async function getCustomers(): Promise<Customer[]> {
  const res = await authFetch('/api/customers');
  return handleResponse<Customer[]>(res, { auth: true });
}

export async function getInventorySummary(): Promise<InventorySummary> {
  const res = await authFetch('/api/inventory/summary');
  return handleResponse<InventorySummary>(res, { auth: true });
}

export async function createPaymentSession(body: {
  amountNaira: number;
  custEmail: string;
  custName?: string;
  payItemName?: string;
}): Promise<PaymentSession> {
  const res = await authFetch('/api/payments/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse<PaymentSession>(res, { auth: true });
}

export async function requestWithdrawal(amount: number): Promise<unknown> {
  const res = await authFetch('/api/withdraw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  });
  return handleResponse(res, { auth: true });
}
