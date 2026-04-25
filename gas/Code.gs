/**
 * Gallery Warehouse Management — Google Apps Script Backend
 *
 * SETUP:
 * 1. Create a Google Spreadsheet with three sheets:
 *    - "Artworks"      columns: id | title | artist | category | status | qty | edition_total | ap_count | price | location | imageUrl | notes | embedding
 *    - "Transactions"  columns: id | artworkId | artworkTitle | type | qty | date | userId | userName | notes
 *    - "PriceHistory"  columns: id | artworkId | oldPrice | newPrice | date | reason | userId
 * 2. Paste this script in Extensions → Apps Script.
 * 3. Deploy → New Deployment → Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the deployment URL and paste in the app's Settings page.
 *
 * AI Commands via Gemini:
 *   Set the script property "GEMINI_API_KEY" in Project Settings → Script Properties.
 *   The "embedding" column in Artworks is auto-filled via text-embedding-004 on create/update.
 */

const SHEET_ARTWORKS      = 'Artworks';
const SHEET_TRANSACTIONS  = 'Transactions';
const SHEET_PRICE_HISTORY = 'PriceHistory';
const GEMINI_FLASH_URL    = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=';
const GEMINI_EMBED_URL    = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=';

// ── Routing ──────────────────────────────────────────────────────────────────

function doGet(e) {
  const action = e.parameter.action;
  try {
    if (action === 'getArtworks')     return jsonResponse(getArtworks());
    if (action === 'getPriceHistory') return jsonResponse(getPriceHistory(e.parameter));
    return jsonResponse({ success: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (_) {
    return jsonResponse({ success: false, error: 'Invalid JSON body' });
  }

  const action = body.action;
  try {
    if (action === 'checkIn')          return jsonResponse(processTransaction(body, 'check-in'));
    if (action === 'checkOut')         return jsonResponse(processTransaction(body, 'check-out'));
    if (action === 'createArtwork')    return jsonResponse(createArtwork(body));
    if (action === 'updateArtwork')    return jsonResponse(updateArtwork(body));
    if (action === 'updatePrice')      return jsonResponse(updateArtworkPrice(body));
    if (action === 'bulkUpdatePrices') return jsonResponse(bulkUpdatePrices(body));
    if (action === 'aiCommand')        return jsonResponse(processAiCommand(body));
    return jsonResponse({ success: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({
      success: false,
      error: err.message,
      data: { message: 'GAS_ERROR: ' + err.message, stack: err.stack }
    });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Artworks ─────────────────────────────────────────────────────────────────

function getArtworks() {
  const sheet = getSheet(SHEET_ARTWORKS);
  const [headers, ...rows] = sheet.getDataRange().getValues();
  const artworks = rows
    .filter(row => row[0])
    .map(row => {
      const obj = rowToObject(headers, row);
      delete obj.embedding; // Don't send large embedding vectors to frontend
      return obj;
    });
  return { success: true, data: artworks };
}

function createArtwork(body) {
  if (!body.title || !body.artist) throw new Error('title and artist are required');
  const sheet = getSheet(SHEET_ARTWORKS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const qty = Number(body.qty) || 0;
  const artwork = {
    id: 'art-' + Date.now(),
    title: body.title || '',
    artist: body.artist || '',
    category: body.category || '',
    status: qty > 0 ? 'in-stock' : 'out',
    qty,
    edition_total: body.edition_total != null && body.edition_total !== '' ? Number(body.edition_total) : '',
    ap_count: body.ap_count != null && body.ap_count !== '' ? Number(body.ap_count) : '',
    price: body.price != null && body.price !== '' ? Number(body.price) : '',
    location: body.location || '',
    imageUrl: body.imageUrl || '',
    notes: body.notes || '',
  };

  const row = headers.map(h => (artwork[h] !== undefined ? artwork[h] : ''));
  sheet.appendRow(row);
  generateArtworkVector(artwork);
  return { success: true, data: artwork };
}

function updateArtwork(body) {
  if (!body.id) throw new Error('id is required');
  const sheet = getSheet(SHEET_ARTWORKS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx  = headers.indexOf('id');
  const qtyIdx = headers.indexOf('qty');
  const stIdx  = headers.indexOf('status');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) !== String(body.id)) continue;
    headers.forEach((h, j) => {
      if (h !== 'id' && h !== 'status' && h !== 'embedding' && body[h] !== undefined) {
        sheet.getRange(i + 1, j + 1).setValue(body[h]);
      }
    });
    if (qtyIdx !== -1 && stIdx !== -1 && body.qty !== undefined) {
      const newQty = Number(body.qty) || 0;
      sheet.getRange(i + 1, stIdx + 1).setValue(newQty > 0 ? 'in-stock' : 'out');
    }
    // Re-read the full updated row to regenerate embedding
    const updatedRow = sheet.getRange(i + 1, 1, 1, headers.length).getValues()[0];
    generateArtworkVector(rowToObject(headers, updatedRow));
    return { success: true, data: body };
  }
  throw new Error('Artwork not found: ' + body.id);
}

function updateArtworkStock(artworkId, delta) {
  const sheet   = getSheet(SHEET_ARTWORKS);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol   = headers.indexOf('id');
  const qtyCol  = headers.indexOf('qty');
  const stCol   = headers.indexOf('status');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(artworkId)) {
      const newQty = Math.max(0, Number(data[i][qtyCol]) + delta);
      sheet.getRange(i + 1, qtyCol + 1).setValue(newQty);
      sheet.getRange(i + 1, stCol  + 1).setValue(newQty > 0 ? 'in-stock' : 'out');
      return { title: data[i][headers.indexOf('title')], qty: newQty };
    }
  }
  throw new Error('Artwork not found: ' + artworkId);
}

// ── Price Management ──────────────────────────────────────────────────────────

function updateArtworkPrice(body) {
  const { artworkId, newPrice, reason, userId } = body;
  if (!artworkId || newPrice === undefined) throw new Error('artworkId and newPrice are required');
  if (!reason) throw new Error('reason is required');

  const sheet   = getSheet(SHEET_ARTWORKS);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx    = headers.indexOf('id');
  const priceIdx = headers.indexOf('price');

  let oldPrice = 0;
  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) !== String(artworkId)) continue;
    oldPrice = Number(data[i][priceIdx]) || 0;
    sheet.getRange(i + 1, priceIdx + 1).setValue(Number(newPrice));
    found = true;
    break;
  }
  if (!found) throw new Error('Artwork not found: ' + artworkId);

  const histId = 'ph-' + Date.now();
  const now = new Date().toISOString();
  getSheet(SHEET_PRICE_HISTORY).appendRow([
    histId, artworkId, oldPrice, Number(newPrice), now, reason || '', userId || '',
  ]);

  return {
    success: true,
    data: { id: histId, artworkId, oldPrice, newPrice: Number(newPrice), date: now, reason: reason || '', userId: userId || '' },
  };
}

function getPriceHistory(params) {
  const sheet = getSheet(SHEET_PRICE_HISTORY);
  const [headers, ...rows] = sheet.getDataRange().getValues();
  let history = rows
    .filter(row => row[0])
    .map(row => rowToObject(headers, row));
  if (params.artworkId) {
    history = history.filter(h => String(h.artworkId) === String(params.artworkId));
  }
  return { success: true, data: history };
}

function bulkUpdatePrices(body) {
  const { artist, percentage, reason, userId } = body;
  if (!artist || percentage === undefined) throw new Error('artist and percentage are required');
  if (!reason) throw new Error('reason is required');

  const artSheet  = getSheet(SHEET_ARTWORKS);
  const data      = artSheet.getDataRange().getValues();
  const headers   = data[0];
  const artistIdx = headers.indexOf('artist');
  const priceIdx  = headers.indexOf('price');
  const idIdx     = headers.indexOf('id');

  if (artistIdx === -1 || priceIdx === -1 || idIdx === -1) {
    throw new Error('Required columns (artist, price, id) not found in Artworks sheet');
  }

  const multiplier = 1 + Number(percentage) / 100;
  const now        = new Date().toISOString();
  const histSheet  = getSheet(SHEET_PRICE_HISTORY);
  let updated = 0;

  for (let i = 1; i < data.length; i++) {
    if (!data[i][idIdx]) continue;
    if (String(data[i][artistIdx]).trim() !== String(artist).trim()) continue;
    const oldPrice = Number(data[i][priceIdx]) || 0;
    if (oldPrice === 0) continue;
    const newPrice = Math.round(oldPrice * multiplier);
    artSheet.getRange(i + 1, priceIdx + 1).setValue(newPrice);
    histSheet.appendRow([
      'ph-' + Date.now() + '-' + i,
      data[i][idIdx], oldPrice, newPrice, now, reason, userId || '',
    ]);
    updated++;
  }

  return {
    success: true,
    data: { updated },
    message: `Updated prices for ${updated} artwork(s) by ${artist}.`,
  };
}

// ── Transactions ──────────────────────────────────────────────────────────────

function processTransaction(body, type) {
  const { artworkId, qty, userId, userName, notes } = body;
  if (!artworkId || !qty) throw new Error('artworkId and qty are required');

  const delta   = type === 'check-in' ? Number(qty) : -Number(qty);
  const updated = updateArtworkStock(artworkId, delta);

  const txId = 'tx-' + Date.now();
  const row  = [
    txId, artworkId, updated.title, type, qty,
    new Date().toISOString(), userId || '', userName || '', notes || '',
  ];
  getSheet(SHEET_TRANSACTIONS).appendRow(row);

  return {
    success: true,
    message: `${type === 'check-in' ? 'Checked in' : 'Checked out'} ${qty}× "${updated.title}". New qty: ${updated.qty}.`,
    data: { id: txId, artworkId, artworkTitle: updated.title, type, qty, date: row[5] },
  };
}

// ── Vector Embeddings ─────────────────────────────────────────────────────────

function getGeminiEmbedding(text) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) return null;
  const response = UrlFetchApp.fetch(GEMINI_EMBED_URL + apiKey, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text }] },
    }),
    muteHttpExceptions: true,
  });
  const json = JSON.parse(response.getContentText());
  return json.embedding?.values ?? null;
}

function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot   += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function generateArtworkVector(artwork) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) return;
  const text = [artwork.title, artwork.artist, artwork.category, artwork.notes]
    .filter(Boolean).join(' ').trim();
  if (!text) return;

  const embedding = getGeminiEmbedding(text);
  if (!embedding) return;

  const sheet   = getSheet(SHEET_ARTWORKS);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx   = headers.indexOf('id');
  const embIdx  = headers.indexOf('embedding');
  if (embIdx === -1) return; // Column not added to sheet yet

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(artwork.id)) {
      sheet.getRange(i + 1, embIdx + 1).setValue(JSON.stringify(embedding));
      return;
    }
  }
}

function searchArtworksByVector(queryText) {
  console.log('[searchArtworksByVector] queryText: ' + queryText);
  Logger.log('[searchArtworksByVector] queryText: ' + queryText);

  // Reads raw sheet data so the embedding column is ALWAYS present
  var sheetData = getSheet(SHEET_ARTWORKS).getDataRange().getValues();
  var headers   = sheetData[0];
  var embIdx    = headers.indexOf('embedding');
  console.log('[searchArtworksByVector] headers: ' + JSON.stringify(headers));
  console.log('[searchArtworksByVector] embIdx: ' + embIdx + '  total rows (incl header): ' + sheetData.length);
  Logger.log('[searchArtworksByVector] headers: ' + JSON.stringify(headers));
  Logger.log('[searchArtworksByVector] embIdx: ' + embIdx + '  total rows (incl header): ' + sheetData.length);

  // Build artwork list — plain indexed loop (no destructuring, no for…of)
  var allArtworks = [];
  for (var r = 1; r < sheetData.length; r++) {
    if (sheetData[r][0]) allArtworks.push(rowToObject(headers, sheetData[r]));
  }
  console.log('[searchArtworksByVector] allArtworks loaded: ' + allArtworks.length);
  Logger.log('[searchArtworksByVector] allArtworks loaded: ' + allArtworks.length);

  // Count how many have a non-empty embedding
  var withEmb = allArtworks.filter(function(a){ return !!a.embedding; }).length;
  console.log('[searchArtworksByVector] artworks WITH embedding: ' + withEmb + ' / ' + allArtworks.length);
  Logger.log('[searchArtworksByVector] artworks WITH embedding: ' + withEmb + ' / ' + allArtworks.length);

  // Step 1: Text match — check if query CONTAINS a known title or artist name
  var qLower      = queryText.toLowerCase();
  var textMatches = [];
  for (var t = 0; t < allArtworks.length; t++) {
    var at     = allArtworks[t];
    var title  = (at.title  || '').toLowerCase();
    var artist = (at.artist || '').toLowerCase();
    if ((title.length  > 0 && qLower.indexOf(title)  !== -1) ||
        (artist.length > 1 && qLower.indexOf(artist) !== -1)) {
      textMatches.push(at);
    }
  }
  console.log('[searchArtworksByVector] text-match hits: ' + textMatches.length + (textMatches.length > 0 ? ' → ' + textMatches.map(function(a){ return a.title; }).join(', ') : ''));
  Logger.log('[searchArtworksByVector] text-match hits: ' + textMatches.length + (textMatches.length > 0 ? ' → ' + textMatches.map(function(a){ return a.title; }).join(', ') : ''));
  if (textMatches.length > 0) {
    return textMatches.slice(0, 3).map(stripEmbedding);
  }

  // Step 2: Vector similarity fallback
  if (embIdx === -1) {
    console.log('[searchArtworksByVector] embedding column NOT FOUND — aborting vector search');
    Logger.log('[searchArtworksByVector] embedding column NOT FOUND — aborting vector search');
    return [];
  }

  var queryVec = getGeminiEmbedding(queryText);
  console.log('[searchArtworksByVector] queryVec obtained: ' + (Array.isArray(queryVec) ? 'YES, length=' + queryVec.length : 'NULL/INVALID'));
  Logger.log('[searchArtworksByVector] queryVec obtained: ' + (Array.isArray(queryVec) ? 'YES, length=' + queryVec.length : 'NULL/INVALID'));
  if (!Array.isArray(queryVec)) return [];

  var THRESHOLD = 0.55; // Slightly relaxed from 0.6 to catch near-misses
  var scored    = [];

  for (var v = 0; v < allArtworks.length; v++) {
    var av = allArtworks[v];
    if (!av.embedding) continue;
    var storedVector;
    try {
      storedVector = JSON.parse(String(av.embedding));
    } catch (e) {
      console.log('[searchArtworksByVector] JSON.parse FAILED for artwork: ' + av.title);
      Logger.log('[searchArtworksByVector] JSON.parse FAILED for artwork: ' + av.title);
      continue;
    }
    if (!Array.isArray(storedVector)) continue;
    var score = cosineSimilarity(queryVec, storedVector);
    console.log('[searchArtworksByVector] score=' + score.toFixed(4) + '  title=' + av.title + (score >= THRESHOLD ? '  ✓ ABOVE THRESHOLD' : ''));
    Logger.log('[searchArtworksByVector] score=' + score.toFixed(4) + '  title=' + av.title + (score >= THRESHOLD ? '  ABOVE THRESHOLD' : ''));
    if (score >= THRESHOLD) scored.push({ artwork: av, score: score });
  }

  console.log('[searchArtworksByVector] scored above threshold ' + THRESHOLD + ': ' + scored.length);
  Logger.log('[searchArtworksByVector] scored above threshold ' + THRESHOLD + ': ' + scored.length);

  scored.sort(function(x, y) { return y.score - x.score; });
  return scored.slice(0, 3).map(function(s) { return stripEmbedding(s.artwork); });
}

function stripEmbedding(artwork) {
  const copy = Object.assign({}, artwork);
  delete copy.embedding;
  return copy;
}

// ── AI Command Router ─────────────────────────────────────────────────────────

function processAiCommand(body) {
  const { command, userId, userName } = body;
  console.log('[processAiCommand] RAW COMMAND: ' + JSON.stringify(command));
  Logger.log('[processAiCommand] RAW COMMAND: ' + JSON.stringify(command));

  if (!command) throw new Error('command is required');

  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  console.log('[processAiCommand] API KEY present: ' + !!apiKey);
  Logger.log('[processAiCommand] API KEY present: ' + !!apiKey);

  if (!apiKey) {
    console.log('[processAiCommand] No API key — using fallback');
    Logger.log('[processAiCommand] No API key — using fallback');
    const { data: artworks } = getArtworks();
    return fallbackAiCommand(command, artworks, userId, userName);
  }

  // Classify intent: SEARCH vs TRANSACTION
  const classifyPrompt =
    `Classify the following user command as either SEARCH or TRANSACTION.\n` +
    `SEARCH: user is asking a question, looking up inventory status, or requesting information.\n` +
    `TRANSACTION: user is performing an action such as check-in, check-out, selling, or receiving artworks.\n` +
    `User command: "${command}"\n` +
    `Reply with exactly one word: SEARCH or TRANSACTION.`;

  const rawIntent = geminiFlash(classifyPrompt, apiKey);
  const intent    = rawIntent.toUpperCase();
  console.log('[processAiCommand] RAW INTENT FROM GEMINI: "' + rawIntent + '"  →  normalised: "' + intent + '"');
  Logger.log('[processAiCommand] RAW INTENT FROM GEMINI: "' + rawIntent + '"  →  normalised: "' + intent + '"');

  if (intent.startsWith('TRANSACTION')) {
    console.log('[processAiCommand] → routing to handleTransactionIntent');
    Logger.log('[processAiCommand] → routing to handleTransactionIntent');
    return handleTransactionIntent(command, userId, userName, apiKey);
  }
  console.log('[processAiCommand] → routing to handleSearchIntent');
  Logger.log('[processAiCommand] → routing to handleSearchIntent');
  return handleSearchIntent(command, apiKey);
}

function handleTransactionIntent(command, userId, userName, apiKey) {
  console.log('[handleTransactionIntent] command: ' + command);
  Logger.log('[handleTransactionIntent] command: ' + command);

  // Ask Gemini only to extract intent — no need to supply inventory or IDs
  const extractPrompt =
    `You are an inventory assistant for an art gallery.\n` +
    `User command: "${command}"\n\n` +
    `Extract the transaction and return ONLY valid JSON (no markdown):\n` +
    `{"artworkTitle":"<artwork name mentioned by user>","action":"check-in"|"check-out","qty":<number>,"reason":"<brief reason>"}`;

  const text = geminiFlash(extractPrompt, apiKey);
  console.log('[handleTransactionIntent] Gemini raw extract: ' + text);
  Logger.log('[handleTransactionIntent] Gemini raw extract: ' + text);

  let parsed;
  try {
    parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
  } catch (_) {
    console.log('[handleTransactionIntent] JSON parse FAILED');
    Logger.log('[handleTransactionIntent] JSON parse FAILED');
    return { success: false, error: 'AI 無法解析指令。', data: { message: text } };
  }

  console.log('[handleTransactionIntent] parsed.artworkTitle: ' + parsed.artworkTitle + '  action: ' + parsed.action + '  qty: ' + parsed.qty);
  Logger.log('[handleTransactionIntent] parsed.artworkTitle: ' + parsed.artworkTitle + '  action: ' + parsed.action + '  qty: ' + parsed.qty);

  if (!parsed.artworkTitle) {
    console.log('[handleTransactionIntent] No artworkTitle in parsed JSON — aborting');
    Logger.log('[handleTransactionIntent] No artworkTitle in parsed JSON — aborting');
    return { success: false, error: '找不到匹配的作品。', data: { message: '請確認作品名稱是否正確。' } };
  }

  // Use vector search to fuzzy-match the extracted title against the real inventory
  const matches = searchArtworksByVector(parsed.artworkTitle);
  console.log('[handleTransactionIntent] searchArtworksByVector returned ' + matches.length + ' match(es): ' + matches.map(function(m){ return m.title; }).join(', '));
  Logger.log('[handleTransactionIntent] searchArtworksByVector returned ' + matches.length + ' match(es): ' + matches.map(function(m){ return m.title; }).join(', '));

  if (matches.length === 0) {
    return { success: false, error: '找不到匹配的作品。', data: { message: `找不到與「${parsed.artworkTitle}」相關的作品，請確認名稱。` } };
  }

  const artwork = matches[0]; // Top cosine-similarity result
  const txBody = {
    artworkId: artwork.id,
    qty: Number(parsed.qty) || 1,
    userId,
    userName,
    notes: 'AI: ' + command,
  };
  const txResult = processTransaction(txBody, parsed.action === 'check-in' ? 'check-in' : 'check-out');

  const confirmPrompt = `用繁體中文一句話確認以下庫存操作已完成：${txResult.message}`;
  const confirmMsg = geminiFlash(confirmPrompt, apiKey);
  console.log('[handleTransactionIntent] Final confirm reply: ' + confirmMsg);
  Logger.log('[handleTransactionIntent] Final confirm reply: ' + confirmMsg);
  return { success: true, data: { message: confirmMsg || txResult.message } };
}

function handleSearchIntent(command, apiKey) {
  console.log('[handleSearchIntent] command: ' + command);
  Logger.log('[handleSearchIntent] command: ' + command);

  const topMatches = searchArtworksByVector(command);

  console.log('[handleSearchIntent] topMatches count: ' + topMatches.length);
  Logger.log('[handleSearchIntent] topMatches count: ' + topMatches.length);
  if (topMatches.length > 0) {
    var titles = topMatches.map(function(a){ return a.title; }).join(', ');
    console.log('[handleSearchIntent] matched titles: ' + titles);
    Logger.log('[handleSearchIntent] matched titles: ' + titles);
  }

  if (topMatches.length === 0) {
    console.log('[handleSearchIntent] NO MATCHES — returning 找不到 message');
    Logger.log('[handleSearchIntent] NO MATCHES — returning 找不到 message');
    return { success: true, data: { message: '抱歉，我在庫存中找不到相關的作品，請確認作品名稱或條件。' } };
  }

  const matchContext = topMatches.map(a =>
    `《${a.title}》作者：${a.artist}，類別：${a.category || '未分類'}，` +
    `庫存：${a.qty} 件，狀態：${a.status === 'in-stock' ? '有庫存' : '已售罄'}，` +
    `地點：${a.location || '未指定'}，備註：${a.notes || '無'}`
  ).join('\n');

  const responsePrompt =
    `你是一個友善的藝廊助理。用戶詢問：「${command}」\n\n` +
    `根據以下庫存資料，用自然、簡短的繁體中文回答（2-3句即可）：\n${matchContext}`;

  const reply = geminiFlash(responsePrompt, apiKey);
  console.log('[handleSearchIntent] FINAL GEMINI REPLY: ' + reply);
  Logger.log('[handleSearchIntent] FINAL GEMINI REPLY: ' + reply);
  if (!reply) {
    const debugMsg = 'DEBUG_EMPTY_REPLY: Gemini returned no text. ' +
      topMatches.length + ' match(es) found: ' +
      topMatches.map(function(a) { return a.title; }).join(', ');
    console.log('[handleSearchIntent] ' + debugMsg);
    Logger.log('[handleSearchIntent] ' + debugMsg);
    return { success: true, data: { message: debugMsg } };
  }
  return { success: true, data: { message: reply } };
}

function geminiFlash(prompt, apiKey) {
  const response = UrlFetchApp.fetch(GEMINI_FLASH_URL + apiKey, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    muteHttpExceptions: true,
  });
  const statusCode = response.getResponseCode();
  const rawText    = response.getContentText();
  console.log('[geminiFlash] HTTP ' + statusCode + '  raw(600): ' + rawText.substring(0, 600));
  Logger.log('[geminiFlash] HTTP ' + statusCode + '  raw(600): ' + rawText.substring(0, 600));
  const json = JSON.parse(rawText);
  if (json.error) {
    throw new Error('Gemini API error ' + statusCode + ': ' + (json.error.message || JSON.stringify(json.error)));
  }
  return (json.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
}

function fallbackAiCommand(command, artworks, userId, userName) {
  const lower = command.toLowerCase();

  let action;
  if (/check.?in|receiv|arriv|stock.?in|add|入庫/i.test(lower)) action = 'check-in';
  else if (/check.?out|sell|sold|ship|remov|out|賣出|售出|出庫/i.test(lower)) action = 'check-out';
  else return { success: false, error: 'Could not determine action (check-in/check-out).', data: { message: 'Try phrasing like "sold 2 X" or "checked in 3 Y".' } };

  const qtyMatch = lower.match(/\b(\d+)\b/);
  const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;

  const words = lower.split(/\s+/).filter(w => w.length > 2);
  let best = null, bestScore = 0;
  for (const a of artworks) {
    const haystack = (a.title + ' ' + a.artist).toLowerCase();
    const score = words.reduce((s, w) => s + (haystack.includes(w) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; best = a; }
  }

  if (!best || bestScore === 0) {
    return { success: false, error: 'Could not match any artwork.', data: { message: 'Try including the exact artwork title.' } };
  }

  const txBody = { artworkId: best.id, qty, userId, userName, notes: 'AI: ' + command };
  const result = processTransaction(txBody, action);
  return { success: true, data: { message: result.message } };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSheet(name) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

function rowToObject(headers, row) {
  return headers.reduce((obj, key, i) => {
    obj[key] = row[i] ?? '';
    return obj;
  }, {});
}
