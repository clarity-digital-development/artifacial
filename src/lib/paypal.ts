/**
 * PayPal Payouts API client — uses fetch directly (no SDK).
 * Supports both sandbox and production environments.
 */

const PAYPAL_BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

// ─── Token Cache ───

interface TokenCache {
  accessToken: string;
  expiresAt: number; // unix ms
}

let _tokenCache: TokenCache | null = null;

export async function getPayPalAccessToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid (with 60-second buffer)
  if (_tokenCache && _tokenCache.expiresAt - 60_000 > now) {
    return _tokenCache.accessToken;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID!;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET!;

  if (!clientId || !clientSecret) {
    throw new Error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`PayPal token request failed: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  const ttlMs = (data.expires_in ?? 28800) * 1000; // default 8 hours

  _tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + ttlMs,
  };

  return _tokenCache.accessToken;
}

// ─── Payout Types ───

export interface PayPalPayoutItem {
  receiverEmail: string;
  amount: number;       // USD, decimal (e.g. 52.40)
  currency: string;     // e.g. "USD"
  senderItemId: string; // idempotency key (e.g. payoutRequest ID)
  note: string;
}

export interface PayPalPayoutResult {
  batchId: string;
  status: string;
}

// ─── Create Payout ───

export async function createPayPalPayout(
  items: PayPalPayoutItem[]
): Promise<PayPalPayoutResult> {
  const accessToken = await getPayPalAccessToken();

  const body = {
    sender_batch_header: {
      sender_batch_id: `ARTI_${Date.now()}`,
      email_subject: "Your Artifacial affiliate commission payout",
      email_message:
        "You have received a payout for your affiliate commissions with Artifacial.",
    },
    items: items.map((item) => ({
      recipient_type: "EMAIL",
      amount: {
        value: item.amount.toFixed(2),
        currency: item.currency.toUpperCase(),
      },
      note: item.note,
      sender_item_id: item.senderItemId,
      receiver: item.receiverEmail,
    })),
  };

  const res = await fetch(`${PAYPAL_BASE_URL}/v1/payments/payouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`PayPal payout creation failed: ${res.status} ${errorText}`);
  }

  const data = await res.json();

  return {
    batchId: data.batch_header?.payout_batch_id ?? "",
    status: data.batch_header?.batch_status ?? "PENDING",
  };
}
