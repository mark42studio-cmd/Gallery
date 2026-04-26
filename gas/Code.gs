/**
 * Gallery Warehouse Management — Google Apps Script Backend
 *
 * SETUP:
 * 1. Create a Google Spreadsheet with sheets:
 *    - "Artworks"      columns: id | title | artist | category | status | qty | edition_total | ap_count | price | location | imageUrl | notes | embedding
 *    - "Transactions"  columns: id | artworkId | artworkTitle | type | qty | date | userId | userName | notes
 *    - "PriceHistory"  columns: id | artworkId | oldPrice | newPrice | date | reason | userId
 *    - "Editions"      columns: artworkId | edition_number | location_category | location_detail | is_sold | sold_price | is_framed | notes
 * 2. Paste this script in Extensions → Apps Script.
 * 3. Deploy → New Deployment → Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the deployment URL and paste in the app's Settings page.
 *
 * AI Commands via Gemini:
 *   Set script property "GEMINI_API_KEY" in Project Settings → Script Properties.
 *   The "embedding" column in Artworks is auto-filled via text-embedding-004 on create/update.
 *
 * Image uploads:
 *   Artwork images are stored in a Google Drive folder named "Gallery_Images".
 *   Files are set to "Anyone with link can view" and the thumbnail URL is saved to imageUrl.
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
    if (action === 'getArtworks')             return jsonResponse(getArtworks());
    if (action === 'getPriceHistory')         return jsonResponse(getPriceHistory(e.parameter));
    if (action === 'getEditions')             return jsonResponse(getEditions(e.parameter));
    if (action === 'getQuickSourceLocations') return jsonResponse(getQuickSourceLocations(e.parameter));
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
    if (action === 'checkIn')                        return jsonResponse(processTransaction(body, 'check-in'));
    if (action === 'checkOut')                       return jsonResponse(processTransaction(body, 'check-out'));
    if (action === 'createArtwork')                  return jsonResponse(createNewArtwork(body));
    if (action === 'updateArtwork')                  return jsonResponse(updateArtwork(body));
    if (action === 'updatePrice')                    return jsonResponse(updateArtworkPrice(body));
    if (action === 'bulkUpdatePrices')               return jsonResponse(bulkUpdatePrices(body));
    if (action === 'aiCommand')                      return jsonResponse(processAiCommand(body));
    if (action === 'executeConfirmedTransaction')    return jsonResponse(executeConfirmedTransaction(body));
    if (action === 'editionTransaction')             return jsonResponse(editionTransaction(body));
    if (action === 'uploadImage')                    return jsonResponse(uploadImageToDrive(body.base64Data, body.fileName));
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
      delete obj.embedding;
      return obj;
    });
  return { success: true, data: artworks };
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
    if (String(data[i][idIdx]).trim() !== String(body.id).trim()) continue;
    headers.forEach((h, j) => {
      if (h !== 'id' && h !== 'status' && h !== 'embedding' && body[h] !== undefined) {
        sheet.getRange(i + 1, j + 1).setValue(body[h]);
      }
    });
    if (qtyIdx !== -1 && stIdx !== -1 && body.qty !== undefined) {
      const newQty = Number(body.qty) || 0;
      sheet.getRange(i + 1, stIdx + 1).setValue(newQty > 0 ? 'in-stock' : 'out');
    }
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
    if (String(data[i][idCol]).trim() === String(artworkId).trim()) {
      const newQty = Math.max(0, Number(data[i][qtyCol]) + delta);
      sheet.getRange(i + 1, qtyCol + 1).setValue(newQty);
      sheet.getRange(i + 1, stCol  + 1).setValue(newQty > 0 ? 'in-stock' : 'out');
      return { title: String(data[i][headers.indexOf('title')] || ''), qty: newQty };
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
    if (String(data[i][idIdx]).trim() !== String(artworkId).trim()) continue;
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
  const { artworkId, qty, userId, userName, notes, outSubtype, destination, buyerName, soldPrice } = body;
  if (!artworkId || !qty) throw new Error('artworkId and qty are required');

  const delta   = type === 'check-in' ? Number(qty) : -Number(qty);
  const updated = updateArtworkStock(artworkId, delta);

  if (type === 'check-out') {
    if (outSubtype === 'sold' && buyerName) {
      _updateArtworkLocation(artworkId, '已售：' + buyerName);
    } else if (outSubtype === 'transfer' && destination) {
      _updateArtworkLocation(artworkId, destination);
    }
  }

  let fullNotes = notes || '';
  if (type === 'check-out' && buyerName) {
    fullNotes = '售予：' + buyerName + (soldPrice ? '，成交價：NT$' + soldPrice : '') + (fullNotes ? '，' + fullNotes : '');
  } else if (type === 'check-out' && destination) {
    fullNotes = '移轉至：' + destination + (fullNotes ? '，' + fullNotes : '');
  }

  const txId = 'tx-' + Date.now();
  const row  = [
    txId, artworkId, updated.title, type, qty,
    new Date().toISOString(), userId || '', userName || '', fullNotes,
  ];
  getSheet(SHEET_TRANSACTIONS).appendRow(row);

  return {
    success: true,
    message: `${type === 'check-in' ? 'Checked in' : 'Checked out'} ${qty}× "${updated.title}". New qty: ${updated.qty}.`,
    data: { id: txId, artworkId, artworkTitle: updated.title, type, qty, date: row[5] },
  };
}

function _updateArtworkLocation(artworkId, location) {
  const sheet   = getSheet(SHEET_ARTWORKS);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx  = headers.indexOf('id');
  const locIdx = headers.indexOf('location');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]).trim() !== String(artworkId).trim()) continue;
    if (locIdx !== -1) sheet.getRange(i + 1, locIdx + 1).setValue(location);
    break;
  }
}

// ── Editions ──────────────────────────────────────────────────────────────────

function getEditions(params) {
  const artworkId = params.artworkId;
  if (!artworkId) return { success: false, error: 'artworkId is required' };

  const sheet   = getSheet('Editions');
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const artIdIdx = headers.indexOf('artworkId');

  const editions = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    if (String(data[i][artIdIdx]).trim() !== String(artworkId).trim()) continue;
    editions.push(rowToObject(headers, data[i]));
  }
  return { success: true, data: editions };
}

function getQuickSourceLocations(params) {
  const artworkId = params.artworkId;
  if (!artworkId) return { success: false, error: 'artworkId is required' };

  const edSheet   = getSheet('Editions');
  const edData    = edSheet.getDataRange().getValues();
  const edHeaders = edData[0];
  const artIdIdx  = edHeaders.indexOf('artworkId');
  const isSoldIdx = edHeaders.indexOf('is_sold');
  const locCatIdx = edHeaders.indexOf('location_category');
  const locDetIdx = edHeaders.indexOf('location_detail');

  const locations = {};
  for (let i = 1; i < edData.length; i++) {
    if (!edData[i][0]) continue;
    if (String(edData[i][artIdIdx]).trim() !== String(artworkId).trim()) continue;
    const rawSold = edData[i][isSoldIdx];
    const isSold  = rawSold === true || String(rawSold).toUpperCase() === 'TRUE';
    if (isSold) continue;
    const locCat = String(edData[i][locCatIdx] || '').trim();
    if (locCat === '家裡' || locCat === '自家' || locCat === '') continue;
    const detail = String(edData[i][locDetIdx] || '').trim();
    const key = detail || locCat;
    if (key) locations[key] = true;
  }

  // Fallback: non-print artworks store location in Artworks.location
  if (Object.keys(locations).length === 0) {
    const artSheet   = getSheet(SHEET_ARTWORKS);
    const artData    = artSheet.getDataRange().getValues();
    const artHeaders = artData[0];
    const idIdx      = artHeaders.indexOf('id');
    const locIdx     = artHeaders.indexOf('location');
    for (let i = 1; i < artData.length; i++) {
      if (String(artData[i][idIdx]).trim() !== String(artworkId).trim()) continue;
      const loc = String(artData[i][locIdx] || '').trim();
      if (loc && loc !== '家裡' && loc !== '自家') locations[loc] = true;
      break;
    }
  }

  return { success: true, data: Object.keys(locations) };
}

function editionTransaction(body) {
  const { artworkId, editionNumbers, txType, outSubtype, source, destination, soldPrice, userId, userName, notes } = body;
  if (!artworkId || !editionNumbers || !editionNumbers.length) {
    throw new Error('artworkId and editionNumbers are required');
  }

  const edSheet  = getSheet('Editions');
  const data     = edSheet.getDataRange().getValues();
  const headers  = data[0];
  const artIdIdx    = headers.indexOf('artworkId');
  const edNumIdx    = headers.indexOf('edition_number');
  const locCatIdx   = headers.indexOf('location_category');
  const locDetIdx   = headers.indexOf('location_detail');
  const isSoldIdx   = headers.indexOf('is_sold');
  const soldPriceIdx = headers.indexOf('sold_price');
  const edNotesIdx  = headers.indexOf('notes');

  const nums = editionNumbers.map(String);
  let updated = 0;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][artIdIdx]).trim() !== String(artworkId).trim()) continue;
    if (!nums.includes(String(data[i][edNumIdx]).trim())) continue;

    const row = i + 1;
    if (txType === 'check-in') {
      edSheet.getRange(row, locCatIdx + 1).setValue('家裡');
      edSheet.getRange(row, locDetIdx + 1).setValue('');
      if (edNotesIdx !== -1 && source) {
        edSheet.getRange(row, edNotesIdx + 1).setValue('從 ' + source + ' 入庫');
      }
    } else {
      if (outSubtype === 'sold') {
        edSheet.getRange(row, isSoldIdx + 1).setValue(true);
        edSheet.getRange(row, locCatIdx + 1).setValue('已售出');
        edSheet.getRange(row, locDetIdx + 1).setValue(destination || '');
        if (soldPriceIdx !== -1 && soldPrice) {
          edSheet.getRange(row, soldPriceIdx + 1).setValue(Number(soldPrice));
        }
      } else {
        edSheet.getRange(row, locCatIdx + 1).setValue('畫廊');
        edSheet.getRange(row, locDetIdx + 1).setValue(destination || '');
      }
    }
    updated++;
  }

  // Atomic qty sync — reads edition rows and overwrites Artworks qty
  _syncArtworkQty(artworkId);

  const txNotes = notes || (
    txType === 'check-in'
      ? '入庫自：' + (source || '未指定')
      : outSubtype === 'sold'
        ? '售予：' + (destination || '未知') + (soldPrice ? '，成交價：NT$' + soldPrice : '')
        : '移轉至：' + (destination || '未知')
  );
  getSheet(SHEET_TRANSACTIONS).appendRow([
    'tx-' + Date.now(), artworkId, _getArtworkTitle(artworkId),
    txType === 'check-in' ? 'check-in' : 'check-out',
    updated, new Date().toISOString(), userId || '', userName || '', txNotes,
  ]);

  SpreadsheetApp.flush();
  return { success: true, data: { updated } };
}

/**
 * Atomic qty sync: counts every NON-SOLD edition row for this artwork
 * and overwrites qty + status in Artworks sheet.
 * Guard: skips if no edition rows exist (non-print artwork).
 */
function _syncArtworkQty(artworkId) {
  const edSheet   = getSheet('Editions');
  const edData    = edSheet.getDataRange().getValues();
  const edHeaders = edData[0];
  const edArtIdIdx  = edHeaders.indexOf('artworkId');
  const edIsSoldIdx = edHeaders.indexOf('is_sold');
  const edLocCatIdx = edHeaders.indexOf('location_category');

  let editionRows = 0;
  let homeCount   = 0;
  let soldCount   = 0;
  for (let r = 1; r < edData.length; r++) {
    if (!edData[r][0]) continue;
    if (String(edData[r][edArtIdIdx]).trim() !== String(artworkId).trim()) continue;
    editionRows++;
    const rawSold = edData[r][edIsSoldIdx];
    const isSold  = rawSold === true || String(rawSold).toUpperCase() === 'TRUE';
    if (isSold) {
      soldCount++;
    } else {
      const locCat = String(edData[r][edLocCatIdx] || '').trim();
      if (!locCat || locCat === '家裡' || locCat === '自家') homeCount++;
    }
  }

  // Non-print artworks have no edition rows — leave their qty alone
  if (editionRows === 0) return;

  const artSheet    = getSheet(SHEET_ARTWORKS);
  const artData     = artSheet.getDataRange().getValues();
  const artHeaders  = artData[0];
  const artIdColIdx = artHeaders.indexOf('id');
  const qtyIdx      = artHeaders.indexOf('qty');
  const stIdx       = artHeaders.indexOf('status');

  for (let s = 1; s < artData.length; s++) {
    if (String(artData[s][artIdColIdx]).trim() !== String(artworkId).trim()) continue;
    artSheet.getRange(s + 1, qtyIdx + 1).setValue(homeCount);
    const newStatus = homeCount > 0 ? 'in-stock' : (soldCount === editionRows ? 'sold' : 'out');
    artSheet.getRange(s + 1, stIdx  + 1).setValue(newStatus);
    break;
  }
}

function _getArtworkTitle(artworkId) {
  const sheet    = getSheet(SHEET_ARTWORKS);
  const data     = sheet.getDataRange().getValues();
  const headers  = data[0];
  const idIdx    = headers.indexOf('id');
  const titleIdx = headers.indexOf('title');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]).trim() === String(artworkId).trim()) return String(data[i][titleIdx] || '');
  }
  return '';
}

// ── Image Upload ──────────────────────────────────────────────────────────────

/**
 * Uploads a base64-encoded image to a "Gallery_Images" folder in Google Drive,
 * sets public sharing, and returns a thumbnail URL safe for use as <img src>.
 */
function uploadImageToDrive(base64Data, fileName) {
  if (!base64Data) throw new Error('base64Data is required');

  // Strip data-URL prefix if present (data:image/jpeg;base64,...)
  const parts     = String(base64Data).split(',');
  const pureB64   = parts.length > 1 ? parts[1] : parts[0];
  const headerStr = parts.length > 1 ? parts[0] : '';
  const mimeType  = headerStr.indexOf('png') !== -1 ? 'image/png'
                  : headerStr.indexOf('webp') !== -1 ? 'image/webp'
                  : 'image/jpeg';

  const safeName = (fileName || ('img-' + Date.now() + '.jpg'))
    .replace(/[^a-zA-Z0-9._-]/g, '_');

  // Find or create the Gallery_Images folder
  const folderIter = DriveApp.getFoldersByName('Gallery_Images');
  const folder = folderIter.hasNext() ? folderIter.next() : DriveApp.createFolder('Gallery_Images');

  const decoded = Utilities.base64Decode(pureB64);
  const blob    = Utilities.newBlob(decoded, mimeType, safeName);
  const file    = folder.createFile(blob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId     = file.getId();
  const thumbUrl   = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1200';

  console.log('[uploadImageToDrive] uploaded: ' + safeName + '  id: ' + fileId);
  Logger.log('[uploadImageToDrive] uploaded: ' + safeName + '  id: ' + fileId);

  return { success: true, data: { url: thumbUrl, fileId: fileId } };
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
  if (embIdx === -1) return;

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

  var sheetData = getSheet(SHEET_ARTWORKS).getDataRange().getValues();
  var headers   = sheetData[0];
  var embIdx    = headers.indexOf('embedding');

  var allArtworks = [];
  for (var r = 1; r < sheetData.length; r++) {
    if (sheetData[r][0]) allArtworks.push(rowToObject(headers, sheetData[r]));
  }

  // Step 1: exact text match against title or artist
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
  if (textMatches.length > 0) {
    console.log('[searchArtworksByVector] text-match hits: ' + textMatches.map(function(a){ return a.title; }).join(', '));
    Logger.log('[searchArtworksByVector] text-match hits: ' + textMatches.map(function(a){ return a.title; }).join(', '));
    return textMatches.slice(0, 3).map(stripEmbedding);
  }

  // Step 2: vector similarity fallback
  if (embIdx === -1) return [];

  var queryVec = getGeminiEmbedding(queryText);
  if (!Array.isArray(queryVec)) return [];

  var THRESHOLD = 0.55;
  var scored    = [];
  for (var v = 0; v < allArtworks.length; v++) {
    var av = allArtworks[v];
    if (!av.embedding) continue;
    var storedVector;
    try { storedVector = JSON.parse(String(av.embedding)); } catch (e) { continue; }
    if (!Array.isArray(storedVector)) continue;
    var score = cosineSimilarity(queryVec, storedVector);
    if (score >= THRESHOLD) scored.push({ artwork: av, score: score });
  }
  scored.sort(function(x, y) { return y.score - x.score; });
  return scored.slice(0, 3).map(function(s) { return stripEmbedding(s.artwork); });
}

function stripEmbedding(artwork) {
  const copy = Object.assign({}, artwork);
  delete copy.embedding;
  return copy;
}

// ── Inventory Context Builder ─────────────────────────────────────────────────

/**
 * Builds a full, authoritative inventory snapshot by reading Artworks + Editions.
 * Used by handleSearchIntent so Gemini always has exact edition numbers and
 * locations — never relies on vector embeddings for quantity counts.
 */
function getInventoryContext() {
  const artSheet   = getSheet(SHEET_ARTWORKS);
  const artData    = artSheet.getDataRange().getValues();
  const artHeaders = artData[0];
  const idIdx     = artHeaders.indexOf('id');
  const titleIdx  = artHeaders.indexOf('title');
  const artistIdx = artHeaders.indexOf('artist');
  const catIdx    = artHeaders.indexOf('category');
  const qtyIdx    = artHeaders.indexOf('qty');
  const locIdx    = artHeaders.indexOf('location');

  // Read all editions in one shot
  var edMap = {}; // artworkId → { home: [edNums], outside: {loc: [edNums]}, sold: count }
  try {
    const edSheet   = getSheet('Editions');
    const edData    = edSheet.getDataRange().getValues();
    const edHeaders = edData[0];
    const eArtIdIdx  = edHeaders.indexOf('artworkId');
    const eNumIdx    = edHeaders.indexOf('edition_number');
    const eLocCatIdx = edHeaders.indexOf('location_category');
    const eLocDetIdx = edHeaders.indexOf('location_detail');
    const eIsSoldIdx = edHeaders.indexOf('is_sold');

    for (var r = 1; r < edData.length; r++) {
      if (!edData[r][0]) continue;
      const aId = String(edData[r][eArtIdIdx]).trim();
      if (!edMap[aId]) edMap[aId] = { home: [], outside: {}, sold: 0 };

      const rawSold = edData[r][eIsSoldIdx];
      const isSold  = rawSold === true || String(rawSold).toUpperCase() === 'TRUE';
      const edNum   = '#' + String(edData[r][eNumIdx]).trim();

      if (isSold) {
        edMap[aId].sold++;
      } else {
        const lCat = String(edData[r][eLocCatIdx] || '').trim();
        const lDet = String(edData[r][eLocDetIdx] || '').trim();
        const isHome = !lCat || lCat === '家裡' || lCat === '自家';
        if (isHome) {
          edMap[aId].home.push(edNum);
        } else {
          const locKey = lDet || lCat;
          if (!edMap[aId].outside[locKey]) edMap[aId].outside[locKey] = [];
          edMap[aId].outside[locKey].push(edNum);
        }
      }
    }
  } catch (edErr) {
    console.log('[getInventoryContext] Editions read error: ' + edErr.message);
    Logger.log('[getInventoryContext] Editions read error: ' + edErr.message);
    // Continue — non-print artworks don't need editions
  }

  const lines = ['===== 完整庫存快照 ====='];
  for (let i = 1; i < artData.length; i++) {
    if (!artData[i][0]) continue;
    const artId  = String(artData[i][idIdx]).trim();
    const title  = String(artData[i][titleIdx] || '');
    const artist = String(artData[i][artistIdx] || '');
    const cat    = String(artData[i][catIdx]    || '未分類');
    const qty    = Number(artData[i][qtyIdx])   || 0;
    const loc    = String(artData[i][locIdx]    || '');
    const isPrint = cat.indexOf('版') !== -1;

    let line = '‣ ' + title + '（' + artist + '）[' + cat + ']';

    if (isPrint && edMap[artId]) {
      const ed   = edMap[artId];
      const parts = [];
      if (ed.home.length > 0) parts.push('在家：' + ed.home.join(', '));
      const outKeys = Object.keys(ed.outside);
      for (let k = 0; k < outKeys.length; k++) {
        parts.push(outKeys[k] + '：' + ed.outside[outKeys[k]].join(', '));
      }
      if (ed.sold > 0) parts.push('已售出 ' + ed.sold + ' 件');
      line += '  →  ' + (parts.length > 0 ? parts.join('；') : '無可用版次');
    } else {
      line += '  →  庫存：' + qty + ' 件' + (loc ? '，地點：' + loc : '');
    }

    lines.push(line);
  }
  lines.push('========================');
  return lines.join('\n');
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
    const { data: artworks } = getArtworks();
    return fallbackAiCommand(command, artworks, userId, userName);
  }

  const classifyPrompt =
    `Classify the following user command as either SEARCH or TRANSACTION.\n` +
    `SEARCH: user is asking a question, looking up inventory status, or requesting information.\n` +
    `TRANSACTION: user is performing an action such as check-in, check-out, selling, or receiving artworks.\n` +
    `User command: "${command}"\n` +
    `Reply with exactly one word: SEARCH or TRANSACTION.`;

  const rawIntent = geminiFlash(classifyPrompt, apiKey);
  const intent    = rawIntent.toUpperCase();
  console.log('[processAiCommand] intent: "' + intent + '"');
  Logger.log('[processAiCommand] intent: "' + intent + '"');

  if (intent.startsWith('TRANSACTION')) {
    return handleTransactionIntent(command, userId, userName, apiKey);
  }
  return handleSearchIntent(command, apiKey);
}

function handleTransactionIntent(command, userId, userName, apiKey) {
  console.log('[handleTransactionIntent] command: ' + command);
  Logger.log('[handleTransactionIntent] command: ' + command);

  const extractPrompt =
    `You are an inventory assistant for an art gallery.\n` +
    `User command: "${command}"\n\n` +
    `Extract the transaction and return ONLY valid JSON (no markdown, no extra text):\n` +
    `{"artworkTitle":"<artwork name>","action":"check-in"|"check-out","qty":<number>,"outSubtype":"transfer"|"sold"|null,"reason":"<brief reason>"}`;

  const text = geminiFlash(extractPrompt, apiKey);
  console.log('[handleTransactionIntent] Gemini raw extract: ' + text);
  Logger.log('[handleTransactionIntent] Gemini raw extract: ' + text);

  let parsed;
  try {
    parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
  } catch (_) {
    return { success: false, error: 'AI 無法解析指令。', data: { message: text } };
  }

  if (!parsed.artworkTitle) {
    return { success: false, error: '找不到作品名稱。', data: { message: '請確認作品名稱是否正確。' } };
  }

  const matches = searchArtworksByVector(parsed.artworkTitle);
  if (matches.length === 0) {
    return { success: false, error: '找不到匹配的作品。', data: { message: '找不到與「' + parsed.artworkTitle + '」相關的作品，請確認名稱。' } };
  }

  const artwork = matches[0];
  const prepared = {
    artworkId:  String(artwork.id),
    title:      String(artwork.title),
    artist:     String(artwork.artist),
    category:   String(artwork.category || ''),
    currentQty: Number(artwork.qty) || 0,
    action:     parsed.action === 'check-in' ? 'check-in' : 'check-out',
    qty:        Number(parsed.qty) || 1,
    outSubtype: parsed.outSubtype || null,
    userId,
    userName,
    notes:      'AI: ' + command,
  };

  console.log('[handleTransactionIntent] PREPARE_TRANSACTION: ' + JSON.stringify(prepared));
  Logger.log('[handleTransactionIntent] PREPARE_TRANSACTION: ' + JSON.stringify(prepared));

  return { success: true, intent: 'PREPARE_TRANSACTION', data: prepared };
}

function executeConfirmedTransaction(body) {
  const { artworkId, txAction, qty, outSubtype, destination, buyerName, soldPrice, userId, userName, notes } = body;
  if (!artworkId || !txAction) throw new Error('artworkId and txAction are required');

  const txBody = {
    artworkId:   String(artworkId),
    qty:         Number(qty) || 1,
    userId:      userId || '',
    userName:    userName || '',
    notes:       notes || '',
    outSubtype:  outSubtype  || undefined,
    destination: destination || undefined,
    buyerName:   buyerName   || undefined,
    soldPrice:   soldPrice   ? Number(soldPrice) : undefined,
  };

  const result = processTransaction(txBody, txAction === 'check-in' ? 'check-in' : 'check-out');
  return { success: true, data: { message: result.message } };
}

/**
 * Answers inventory questions using a full inventory snapshot injected directly
 * into the Gemini prompt. Quantity counts come from Editions rows, not embeddings.
 */
function handleSearchIntent(command, apiKey) {
  console.log('[handleSearchIntent] command: ' + command);
  Logger.log('[handleSearchIntent] command: ' + command);

  // Build authoritative inventory snapshot
  var inventoryContext = '';
  try {
    inventoryContext = getInventoryContext();
  } catch (ctxErr) {
    console.log('[handleSearchIntent] getInventoryContext error: ' + ctxErr.message);
    Logger.log('[handleSearchIntent] getInventoryContext error: ' + ctxErr.message);
  }

  console.log('[handleSearchIntent] inventoryContext length: ' + inventoryContext.length);
  Logger.log('[handleSearchIntent] inventoryContext:\n' + inventoryContext);

  if (!inventoryContext || inventoryContext.split('\n').length <= 2) {
    return { success: true, data: { message: '庫存目前為空，尚無作品資料。' } };
  }

  var responsePrompt =
    '你是一個專業、精準、冷靜的畫廊倉管員，正在向內部同事回報庫存狀態。\n' +
    '禁止使用「歡迎隨時告訴我」、「如果您有興趣」等推銷語氣，回答要如實、直接。\n\n' +
    '回答規則（依問題意圖擇一）：\n' +
    '  1. 問「家裡有幾件」→ 只報在家（在家：#號）的版次數量。\n' +
    '  2. 問「還剩幾件 / 可賣幾件」→ 報在家＋在外合計，並列明在外地點。\n' +
    '  3. 若已售出 > 0 → 客觀陳述「已售出 X 件」。\n' +
    '  4. 必須根據以下庫存快照中的資料回答，不得自行推測。若找不到相關作品，如實說明。\n\n' +
    inventoryContext + '\n\n' +
    '同事詢問：「' + command + '」\n\n' +
    '請用繁體中文，2-4 句話精確回答，不要冗餘說明。';

  var reply = geminiFlash(responsePrompt, apiKey);
  console.log('[handleSearchIntent] FINAL GEMINI REPLY: ' + reply);
  Logger.log('[handleSearchIntent] FINAL GEMINI REPLY: ' + reply);

  if (!reply) {
    return { success: true, data: { message: '無法取得回應，請稍後再試。' } };
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
  const STRING_FIELDS = new Set(['id', 'title', 'artist']);
  return headers.reduce((obj, key, i) => {
    const val = row[i] ?? '';
    obj[key] = STRING_FIELDS.has(key) ? String(val) : val;
    return obj;
  }, {});
}

function createNewArtwork(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const artSheet = ss.getSheetByName('Artworks');
  const edSheet  = ss.getSheetByName('Editions');

  try {
    const newId   = _generateArtworkId();
    const isPrint = String(payload.category || '').includes('版畫');
    const edTotal = parseInt(payload.edition_total) || 0;
    const apTotal = parseInt(payload.ap_count) || 0;
    const initialQty = isPrint ? (edTotal + apTotal) : (parseInt(payload.qty) || 1);
    const price   = parseInt(payload.price) || 0;

    // Columns: id | title | artist | category | status | qty | edition_total | ap_count | price | location | imageUrl | notes
    artSheet.appendRow([
      newId,
      payload.title       || '',
      payload.artist      || '',
      payload.category    || '',
      'in-stock',
      initialQty,
      isPrint ? edTotal : '',
      isPrint ? apTotal : '',
      price,
      payload.location    || '自家',
      payload.imageUrl    || '',
      payload.notes       || '',
    ]);

    if (isPrint && initialQty > 0) {
      const editionsData = [];
      for (let i = 1; i <= edTotal; i++) {
        editionsData.push([newId, i, '家裡', '', false, price, false, '', payload.title || '']);
      }
      for (let i = 1; i <= apTotal; i++) {
        editionsData.push([newId, 'AP' + i, '家裡', '', false, price, false, '', payload.title || '']);
      }
      if (editionsData.length > 0) {
        edSheet.getRange(edSheet.getLastRow() + 1, 1, editionsData.length, 9).setValues(editionsData);
      }
    }

    SpreadsheetApp.flush();

    // Atomic sync: recount editions and overwrite qty (guards against non-prints)
    if (isPrint) _syncArtworkQty(newId);

    return { success: true, data: { id: newId } };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function _generateArtworkId() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Artworks');
  const ids = sheet.getRange('A2:A').getValues().flat().filter(String);
  if (ids.length === 0) return 'art-001';

  let maxNum = 0;
  ids.forEach(id => {
    const match = String(id).match(/art-(\d+)/);
    if (match) {
      const num = parseInt(match[1]);
      if (num > maxNum) maxNum = num;
    }
  });
  return 'art-' + String(maxNum + 1).padStart(3, '0');
}
