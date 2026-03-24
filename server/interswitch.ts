import { paymentUrlsForMode } from './config.ts';
import type { WorkspaceInterswitch } from './workspaceStore.ts';

export interface AccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export async function fetchPassportAccessToken(
  inter: WorkspaceInterswitch
): Promise<AccessTokenResponse> {
  const { passportUrl } = paymentUrlsForMode(inter.mode);
  const { clientId, secretKey } = inter;

  if (!clientId || !secretKey) {
    throw new Error('Client ID and secret are required (complete signup / Settings → Interswitch).');
  }

  const basic = Buffer.from(`${clientId}:${secretKey}`, 'utf8').toString('base64');
  const url = passportUrl.includes('?') ? passportUrl : `${passportUrl}?grant_type=client_credentials`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=profile',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Passport token failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<AccessTokenResponse>;
}

export interface GetTransactionResponse {
  Amount?: number;
  MerchantReference?: string;
  PaymentReference?: string;
  ResponseCode?: string;
  ResponseDescription?: string;
  TransactionDate?: string;
  [key: string]: unknown;
}

export async function getTransactionJson(
  inter: WorkspaceInterswitch,
  params: {
    merchantCode: string;
    transactionReference: string;
    amountKobo: string;
  }
): Promise<GetTransactionResponse> {
  const { collectionsBase } = paymentUrlsForMode(inter.mode);
  const base = collectionsBase.replace(/\/$/, '');
  const u = new URL(`${base}/gettransaction.json`);
  u.searchParams.set('merchantcode', params.merchantCode);
  u.searchParams.set('transactionreference', params.transactionReference);
  u.searchParams.set('amount', params.amountKobo);

  const res = await fetch(u.toString(), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`gettransaction failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<GetTransactionResponse>;
}

export function nairaToKoboString(naira: number): string {
  return String(Math.round(naira * 100));
}

export function makeTxnRef(prefix = 'KP'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function assertInterswitchReady(inter: WorkspaceInterswitch): { ok: true } | { ok: false; missing: string[] } {
  const missing: string[] = [];
  if (!inter.merchantCode.trim()) missing.push('merchantCode');
  if (!inter.payItemId.trim()) missing.push('payItemId');
  if (!inter.clientId.trim()) missing.push('clientId');
  if (!inter.secretKey.trim()) missing.push('secretKey');
  if (missing.length) return { ok: false, missing };
  return { ok: true };
}
