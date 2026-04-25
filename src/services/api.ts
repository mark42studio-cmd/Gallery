import type { Artwork, Edition, Transaction, PriceHistory, GASResponse, AiCommandResult, PreparedTx } from '../types';

export interface EditionTransactionPayload {
  artworkId: string;
  editionNumbers: (number | string)[];
  txType: 'check-in' | 'check-out';
  outSubtype?: 'transfer' | 'sold';
  source?: string;      // check-in: which gallery the editions came FROM
  destination?: string; // transfer: target gallery; sold: buyer name
  soldPrice?: number;
  userId: string;
  userName: string;
  notes?: string;
}

const GAS_URL_KEY = 'gallery_gas_url';

export const getGASUrl = (): string | null => localStorage.getItem(GAS_URL_KEY);
export const setGASUrl = (url: string): void => localStorage.setItem(GAS_URL_KEY, url);
export const clearGASUrl = (): void => localStorage.removeItem(GAS_URL_KEY);

function requireUrl(): string {
  const url = getGASUrl();
  if (!url) throw new Error('GAS_URL_NOT_SET');
  return url;
}

async function gasGet<T>(params: Record<string, string>): Promise<GASResponse<T>> {
  const url = requireUrl();
  const qs = new URLSearchParams(params).toString();

  let res: Response;
  try {
    // Simple GET — no custom headers so no CORS preflight is triggered on GAS.
    res = await fetch(`${url}?${qs}`, { redirect: 'follow' });
  } catch (networkErr) {
    console.error('[GAS GET] Network error — check URL, CORS, or internet connection:', networkErr);
    throw networkErr;
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseJsonResponse<T>(res);
}

async function gasPost<T>(body: Record<string, unknown>): Promise<GASResponse<T>> {
  const url = requireUrl();

  let res: Response;
  try {
    // text/plain content-type keeps the request "simple" so no CORS preflight
    // is triggered on GAS deployments.
    res = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    console.error('[GAS POST] Network error — check URL, CORS, or internet connection:', networkErr);
    throw networkErr;
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseJsonResponse<T>(res);
}

async function parseJsonResponse<T>(res: Response): Promise<GASResponse<T>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as GASResponse<T>;
  } catch {
    // GAS returns an HTML authorization page when the script needs
    // re-authorization (e.g. after adding new service calls).
    // Surface a clear message instead of a cryptic SyntaxError.
    console.error('[GAS] Response is not JSON — GAS may need re-authorization, or a sheet is missing. First 300 chars:\n', text.slice(0, 300));
    throw new Error(
      'GAS returned non-JSON. Re-authorize the script in Apps Script editor, ' +
      'or check that all three sheets (Artworks, Transactions, PriceHistory) exist.'
    );
  }
}

// Dedicated fetch for the AI chat endpoint.
// Logs the raw response so we can see exactly what GAS returns, then
// tolerates whatever key the script uses (reply / message / text / response).
async function aiCommandFetch(body: Record<string, unknown>): Promise<GASResponse<AiCommandResult>> {
  const url = requireUrl();

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    console.error('[AI Command] Network error:', networkErr);
    throw networkErr;
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const rawText = await res.text();
  console.log('[AI Command] RAW GAS RESPONSE:', rawText);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(`GAS returned non-JSON. Raw preview: ${rawText.substring(0, 150)}`);
  }

  if (parsed.error) {
    return { success: false, error: String(parsed.error) };
  }

  // Multi-turn: PREPARE_TRANSACTION — check top-level intent OR nested data.intent
  const nested = parsed.data as Record<string, unknown> | undefined;
  const topIntent    = parsed.intent as string | undefined;
  const nestedIntent = nested?.intent as string | undefined;

  if (topIntent === 'PREPARE_TRANSACTION' || nestedIntent === 'PREPARE_TRANSACTION') {
    const prepared = (nested?.prepared ?? nested ?? parsed.data) as PreparedTx;
    return { success: true, data: { intent: 'PREPARE_TRANSACTION', prepared } };
  }

  const aiMessage = (nested?.message ?? parsed.message ?? parsed.reply) as string | undefined;

  if (!aiMessage) {
    // Don't throw — surface a readable message instead of crashing the UI
    const keys = Object.keys(parsed).join(', ');
    console.warn('[AI Command] No message key found. Keys:', keys);
    return {
      success: false,
      error: parsed.success === false
        ? (String(parsed.error ?? 'GAS 回傳失敗，請重試。'))
        : `AI 回應格式錯誤（keys: ${keys}）`,
    };
  }

  return { success: true, data: { message: aiMessage } };
}

export const api = {
  getArtworks: () =>
    gasGet<Artwork[]>({ action: 'getArtworks' }),

  createArtwork: (artwork: Omit<Artwork, 'id' | 'status'>) =>
    gasPost<Artwork>({ action: 'createArtwork', ...artwork }),

  updateArtwork: (artwork: Artwork) =>
    gasPost<Artwork>({ action: 'updateArtwork', ...artwork }),

  checkIn: (artworkId: string, qty: number, userId: string, userName: string, notes?: string) =>
    gasPost<Transaction>({ action: 'checkIn', artworkId, qty, userId, userName, notes: notes ?? '' }),

  checkOut: (
    artworkId: string, qty: number, userId: string, userName: string,
    notes?: string, outSubtype?: string, destination?: string, buyerName?: string, soldPrice?: number,
  ) =>
    gasPost<Transaction>({ action: 'checkOut', artworkId, qty, userId, userName, notes: notes ?? '', outSubtype, destination, buyerName, soldPrice }),

  updatePrice: (artworkId: string, newPrice: number, reason: string, userId: string, userName: string) =>
    gasPost<PriceHistory>({ action: 'updatePrice', artworkId, newPrice, reason, userId, userName }),

  getPriceHistory: (artworkId: string) =>
    gasGet<PriceHistory[]>({ action: 'getPriceHistory', artworkId }),

  bulkUpdatePrices: (artist: string, percentage: number, reason: string, userId: string, userName: string) =>
    gasPost<{ updated: number }>({ action: 'bulkUpdatePrices', artist, percentage, reason, userId, userName }),

  getEditions: (artworkId: string) =>
    gasGet<Edition[]>({ action: 'getEditions', artworkId }),

  getQuickSourceLocations: (artworkId: string) =>
    gasGet<string[]>({ action: 'getQuickSourceLocations', artworkId }),

  editionTransaction: (payload: EditionTransactionPayload) =>
    gasPost<{ updated: number }>({ action: 'editionTransaction', ...payload }),

  aiCommand: (command: string, userId: string, userName: string) =>
    aiCommandFetch({ action: 'aiCommand', command, userId, userName }),

  uploadImage: (base64Data: string, fileName: string) =>
    gasPost<{ url: string; fileId: string }>({ action: 'uploadImage', base64Data, fileName }),

  executeConfirmedTransaction: (payload: {
    artworkId: string; txAction: string; qty: number;
    outSubtype?: string; destination?: string; buyerName?: string; soldPrice?: number;
    userId: string; userName: string; notes?: string;
  }) =>
    gasPost<{ message: string }>({
      action:      'executeConfirmedTransaction',
      txAction:    payload.txAction,
      artworkId:   payload.artworkId,
      qty:         payload.qty,
      outSubtype:  payload.outSubtype,
      destination: payload.destination,
      buyerName:   payload.buyerName,
      soldPrice:   payload.soldPrice,
      userId:      payload.userId,
      userName:    payload.userName,
      notes:       payload.notes,
    }),
};
