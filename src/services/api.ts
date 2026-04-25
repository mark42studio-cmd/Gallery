import type { Artwork, Transaction, PriceHistory, GASResponse, AiCommandResult } from '../types';

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

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`GAS returned non-JSON. Raw preview: ${rawText.substring(0, 150)}`);
  }

  if (data.error) {
    return { success: false, error: String(data.error) };
  }

  const aiMessage = (data.reply ?? data.message ?? data.text ?? data.response) as string | undefined;

  if (!aiMessage) {
    throw new Error(`JSON parsed but no message key found. Available keys: ${Object.keys(data).join(', ')}`);
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

  checkOut: (artworkId: string, qty: number, userId: string, userName: string, notes?: string) =>
    gasPost<Transaction>({ action: 'checkOut', artworkId, qty, userId, userName, notes: notes ?? '' }),

  updatePrice: (artworkId: string, newPrice: number, reason: string, userId: string, userName: string) =>
    gasPost<PriceHistory>({ action: 'updatePrice', artworkId, newPrice, reason, userId, userName }),

  getPriceHistory: (artworkId: string) =>
    gasGet<PriceHistory[]>({ action: 'getPriceHistory', artworkId }),

  bulkUpdatePrices: (artist: string, percentage: number, reason: string, userId: string, userName: string) =>
    gasPost<{ updated: number }>({ action: 'bulkUpdatePrices', artist, percentage, reason, userId, userName }),

  aiCommand: (command: string, userId: string, userName: string) =>
    aiCommandFetch({ action: 'aiCommand', command, userId, userName }),
};
