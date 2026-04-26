import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Drawer } from 'vaul';
import {
  X, ArrowDownCircle, ArrowUpCircle, Building2, Tag,
  SlidersHorizontal, Search, RotateCcw, Check,
} from 'lucide-react';
import type { Artwork, Edition, LiffUser } from '../types';
import { api } from '../services/api';

interface Props {
  open: boolean;
  onClose: () => void;
  artworks: Artwork[];
  user: LiffUser | null;
  initialArtwork?: Artwork | null;
  onSuccess: () => void;
}

type TxType     = 'check-in' | 'check-out';
type OutSubtype = 'transfer' | 'sold';

export default function TransactionDrawer({
  open, onClose, artworks, user, initialArtwork, onSuccess,
}: Props) {

  // ── Transaction state ────────────────────────────────────────
  const [txType, setTxType]         = useState<TxType>('check-in');
  const [outSubtype, setOutSubtype] = useState<OutSubtype>('transfer');
  const [artworkId, setArtworkId]   = useState('');
  const [qty, setQty]               = useState(1);

  // Edition state
  const [editions, setEditions]               = useState<Edition[]>([]);
  const [editionsLoading, setEditionsLoading] = useState(false);
  const [selectedNums, setSelectedNums]       = useState<(number | string)[]>([]);
  const [editionRefreshKey, setEditionRefreshKey] = useState(0);

  // Check-in source
  const [sourceLocation, setSourceLocation] = useState('');
  const [quickSources, setQuickSources]     = useState<string[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);

  // Check-out fields
  const [destination, setDestination] = useState('');
  const [buyerName, setBuyerName]     = useState('');
  const [soldPrice, setSoldPrice]     = useState('');

  const [notes, setNotes]           = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback]     = useState<{ ok: boolean; msg: string } | null>(null);

  // ── Filter panel state ───────────────────────────────────────
  const [filterOpen, setFilterOpen]           = useState(false);
  const [draftOnlyExternal, setDraftOnlyExternal] = useState(false);
  const [draftCategory, setDraftCategory]     = useState('');
  const [draftArtworkQuery, setDraftArtworkQuery] = useState('');
  const [queryEditions, setQueryEditions]         = useState<Edition[]>([]);
  const [queryEditionsLoading, setQueryEditionsLoading] = useState(false);
  // Applied (committed) filters
  const [onlyExternal, setOnlyExternal]   = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');

  // ── Derived ──────────────────────────────────────────────────
  const selected       = artworks.find((a) => a.id === artworkId);
  const isPrintmaking  = selected?.category === '版畫';

  const categories = [...new Set(
    artworks.map((a) => String(a.category ?? '')).filter(Boolean)
  )].sort();

  const filteredArtworks = artworks.filter((a) => {
    if (categoryFilter && String(a.category) !== categoryFilter) return false;
    if (onlyExternal) {
      const loc = String(a.location ?? '').trim();
      if (!loc || loc === '家裡' || loc === '自家' || loc === '倉庫') return false;
    }
    return true;
  });

  const filterCount = (onlyExternal ? 1 : 0) + (categoryFilter ? 1 : 0);
  const hasActiveFilters = filterCount > 0;

  const queriedArtwork = draftArtworkQuery.trim()
    ? artworks.find((a) =>
        a.id === draftArtworkQuery.trim() ||
        String(a.title).toLowerCase().includes(draftArtworkQuery.trim().toLowerCase()) ||
        String(a.artist).toLowerCase().includes(draftArtworkQuery.trim().toLowerCase())
      ) ?? null
    : null;

  // ── Reset on open ────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setArtworkId(initialArtwork?.id ?? '');
    setTxType('check-in');
    setOutSubtype('transfer');
    setQty(1);
    setEditions([]);
    setSelectedNums([]);
    setSourceLocation('');
    setQuickSources([]);
    setDestination('');
    setBuyerName('');
    setSoldPrice('');
    setNotes('');
    setFeedback(null);
    setFilterOpen(false);
  }, [open, initialArtwork?.id]);

  // ── Fetch editions for selected artwork ──────────────────────
  useEffect(() => {
    if (!artworkId || !isPrintmaking) {
      setEditions([]);
      setSelectedNums([]);
      return;
    }
    let cancelled = false;
    setEditionsLoading(true);
    api.getEditions(artworkId)
      .then((res) => { if (!cancelled && res.success && res.data) setEditions(res.data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setEditionsLoading(false); });
    return () => { cancelled = true; };
  }, [artworkId, isPrintmaking, editionRefreshKey]);

  // ── Fetch smart source pool on check-in ─────────────────────
  useEffect(() => {
    if (!artworkId || txType !== 'check-in') { setQuickSources([]); return; }
    let cancelled = false;
    setSourcesLoading(true);
    api.getQuickSourceLocations(artworkId)
      .then((res) => { if (!cancelled && res.success && res.data) setQuickSources(res.data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setSourcesLoading(false); });
    return () => { cancelled = true; };
  }, [artworkId, txType]);

  // ── Reset selection on txType change ────────────────────────
  useEffect(() => {
    setSelectedNums([]);
    setSourceLocation('');
    setDestination('');
  }, [txType]);

  // ── Filter panel: edition lookup for artwork query ───────────
  useEffect(() => {
    if (!queriedArtwork) { setQueryEditions([]); return; }
    let cancelled = false;
    setQueryEditionsLoading(true);
    api.getEditions(queriedArtwork.id)
      .then((res) => { if (!cancelled && res.success && res.data) setQueryEditions(res.data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setQueryEditionsLoading(false); });
    return () => { cancelled = true; };
  }, [queriedArtwork?.id]);

  // ── Helpers ──────────────────────────────────────────────────
  function toggleEdition(num: number | string) {
    setSelectedNums((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
    );
  }

  const availableEditions = editions.filter((e) => {
    const isSold = e.is_sold === true || String(e.is_sold).toUpperCase() === 'TRUE';
    if (isSold) return false;
    if (txType === 'check-in') {
      const cat = String(e.location_category ?? '').trim();
      if (cat === '家裡' || cat === '自家') return false;
      if (sourceLocation) {
        const det = String(e.location_detail ?? '').trim();
        return cat === sourceLocation.trim() || det === sourceLocation.trim();
      }
      return true;
    }
    // check-out: every unsold edition is eligible regardless of location
    return true;
  });

  const isOutOfStock =
    txType === 'check-out' && !isPrintmaking && (selected?.qty ?? 0) <= 0;
  const isPrintNoEditions =
    txType === 'check-out' && isPrintmaking && availableEditions.length === 0 && !editionsLoading;

  function applyFilters() {
    setOnlyExternal(draftOnlyExternal);
    setCategoryFilter(draftCategory);
    setFilterOpen(false);
  }

  function resetFilters() {
    setDraftOnlyExternal(false);
    setDraftCategory('');
    setDraftArtworkQuery('');
    setQueryEditions([]);
    setOnlyExternal(false);
    setCategoryFilter('');
  }

  // ── Submit ───────────────────────────────────────────────────
  async function handleSubmit() {
    if (!artworkId || !user) return;
    if (isPrintmaking && selectedNums.length === 0) {
      setFeedback({ ok: false, msg: '請選擇至少一件版號。' }); return;
    }
    if (txType === 'check-out' && outSubtype === 'transfer' && !destination.trim()) {
      setFeedback({ ok: false, msg: '請填寫移轉目的地。' }); return;
    }
    if (txType === 'check-out' && outSubtype === 'sold' && !buyerName.trim()) {
      setFeedback({ ok: false, msg: '請填寫買家名稱。' }); return;
    }
    setIsSubmitting(true);
    setFeedback(null);
    try {
      let res;
      if (isPrintmaking) {
        res = await api.editionTransaction({
          artworkId,
          editionNumbers: selectedNums,
          txType,
          outSubtype:  txType === 'check-out' ? outSubtype : undefined,
          source:      txType === 'check-in' ? sourceLocation || undefined : undefined,
          destination: txType === 'check-out'
            ? (outSubtype === 'transfer' ? destination : buyerName)
            : undefined,
          soldPrice: txType === 'check-out' && outSubtype === 'sold' && soldPrice
            ? Number(soldPrice) : undefined,
          userId:   user.userId,
          userName: user.displayName,
          notes,
        });
      } else {
        if (txType === 'check-in') {
          const checkInNotes = sourceLocation
            ? ('入庫自：' + sourceLocation + (notes ? '，' + notes : ''))
            : notes;
          res = await api.checkIn(artworkId, qty, user.userId, user.displayName, checkInNotes);
        } else {
          res = await api.checkOut(
            artworkId, qty, user.userId, user.displayName, notes,
            outSubtype,
            outSubtype === 'transfer' ? destination : undefined,
            outSubtype === 'sold'     ? buyerName   : undefined,
            outSubtype === 'sold' && soldPrice ? Number(soldPrice) : undefined,
          );
        }
      }
      if (res.success) {
        setFeedback({ ok: true, msg: res.message ?? '交易已記錄。' });
        onSuccess();
        setSelectedNums([]);
        setEditionRefreshKey((k) => k + 1);
      } else {
        setFeedback({ ok: false, msg: res.error ?? '交易失敗。' });
      }
    } catch (err) {
      setFeedback({ ok: false, msg: err instanceof Error ? err.message : '網路錯誤。' });
    } finally {
      setIsSubmitting(false);
    }
  }

  const submitLabel = (() => {
    if (!isPrintmaking) return txType === 'check-in' ? '確認入庫' : '確認出庫';
    if (txType === 'check-in') return '確認入庫';
    return outSubtype === 'sold' ? '確認售出' : '確認移轉';
  })();

  // ── External artworks list (for filter panel preview) ────────
  const externalArtworks = artworks.filter((a) => {
    const loc = String(a.location ?? '').trim();
    return loc && loc !== '家裡' && loc !== '自家' && loc !== '倉庫';
  });

  return (
    <Drawer.Root open={open} onOpenChange={(v) => !v && onClose()} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm" />
        <Drawer.Content className="fixed bottom-0 inset-x-0 z-50 flex flex-col rounded-t-2xl bg-paper shadow-drawer focus:outline-none max-h-[92vh]">

          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-smoke" />
          </div>

          {/* Header */}
          <div className="px-5 pb-2 flex items-center justify-between shrink-0">
            <Drawer.Title className="font-display text-lg font-semibold">進出庫記錄</Drawer.Title>
            <div className="flex items-center gap-2">
              {/* Filter button */}
              <button
                onClick={() => setFilterOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-medium transition-all duration-150 ${
                  filterOpen
                    ? 'bg-ink text-paper'
                    : hasActiveFilters
                    ? 'bg-ink/8 text-ink border border-ink/25'
                    : 'bg-mist text-charcoal hover:bg-smoke'
                }`}
              >
                <SlidersHorizontal size={12} />
                篩選
                {filterCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-ink text-paper inline-flex items-center justify-center text-[10px] leading-none">
                    {filterCount}
                  </span>
                )}
              </button>
              <button onClick={onClose} className="p-1 text-ash hover:text-ink transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Selected artwork identity bar */}
          {selected && (
            <div className="px-5 pb-2.5 pt-0.5 shrink-0 border-b border-smoke/50 flex items-baseline gap-2.5">
              <p className="font-display text-sm font-semibold text-ink leading-snug truncate">{selected.title}</p>
              <p className="text-xs text-ash shrink-0">{selected.artist}</p>
            </div>
          )}

          {/* ══ Filter Panel ══════════════════════════════════════ */}
          {filterOpen && (
            <div className="shrink-0 border-t border-smoke bg-mist/25 px-5 py-3 space-y-3">

              {/* ── Row 1: all controls inline ─────────────────── */}
              <div className="flex items-center gap-3 flex-wrap">

                {/* ① External-only toggle */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={lbl}>在外</span>
                  <button
                    onClick={() => setDraftOnlyExternal((v) => !v)}
                    aria-pressed={draftOnlyExternal}
                    className={`relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none shrink-0 ${
                      draftOnlyExternal ? 'bg-ink' : 'bg-smoke'
                    }`}
                  >
                    <span
                      className={`absolute top-[3px] left-[3px] w-3.5 h-3.5 rounded-full bg-paper shadow-sm transition-transform duration-200 ${
                        draftOnlyExternal ? 'translate-x-[16px]' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Divider */}
                <div className="w-px h-5 bg-smoke/70 shrink-0" />

                {/* ③ Category pills */}
                <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                  <button onClick={() => setDraftCategory('')} className={pill(draftCategory === '')}>
                    全部
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setDraftCategory((prev) => (prev === cat ? '' : cat))}
                      className={pill(draftCategory === cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Divider */}
                <div className="w-px h-5 bg-smoke/70 shrink-0" />

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={resetFilters}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-ash border border-smoke rounded-sm hover:border-charcoal hover:text-charcoal transition-colors"
                  >
                    <RotateCcw size={10} />
                    重設
                  </button>
                  <button
                    onClick={applyFilters}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-ink text-paper rounded-sm hover:bg-charcoal transition-colors"
                  >
                    <Check size={11} />
                    套用
                  </button>
                </div>
              </div>

              {/* ── Row 2: external artworks preview (toggle-gated) ─ */}
              {draftOnlyExternal && (
                <div className="rounded-sm border border-smoke overflow-hidden">
                  {externalArtworks.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-ash">目前無作品在外。</p>
                  ) : (
                    <div className="divide-y divide-smoke/60">
                      {externalArtworks.slice(0, 6).map((a) => (
                        <div key={a.id} className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-xs text-ink font-medium truncate max-w-[60%]">{a.title}</span>
                          <span className="text-[10px] text-ash shrink-0">{a.location}</span>
                        </div>
                      ))}
                      {externalArtworks.length > 6 && (
                        <p className="px-3 py-1 text-[10px] text-ash text-center">…共 {externalArtworks.length} 件</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Row 3: artwork edition lookup ──────────────────── */}
              <div className="space-y-1.5">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ash pointer-events-none" />
                  <input
                    value={draftArtworkQuery}
                    onChange={(e) => setDraftArtworkQuery(e.target.value)}
                    placeholder="版次查詢：輸入作品名稱或藝術家…"
                    className="w-full pl-7 pr-3 py-1.5 text-xs border border-smoke rounded-sm bg-paper text-ink placeholder:text-ash focus:outline-none focus:border-charcoal transition-colors"
                  />
                </div>

                {draftArtworkQuery.trim() && (
                  <div className="rounded-sm border border-smoke overflow-hidden">
                    {queriedArtwork ? (
                      <>
                        <div className="px-3 py-1.5 bg-mist/50 border-b border-smoke/70 flex items-baseline justify-between">
                          <span className="text-xs font-semibold text-ink">{queriedArtwork.title}</span>
                          <span className="text-[10px] text-ash ml-2 shrink-0">{queriedArtwork.artist}</span>
                        </div>
                        {queryEditionsLoading ? (
                          <p className="px-3 py-2 text-xs text-ash animate-pulse">載入版次中…</p>
                        ) : queryEditions.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-ash">
                            {queriedArtwork.location ? `地點：${queriedArtwork.location}` : '無版次資料（一般作品）'}
                          </p>
                        ) : (
                          <div className="divide-y divide-smoke/60 max-h-36 overflow-y-auto">
                            {queryEditions.map((ed, i) => {
                              const isSold = ed.is_sold === true || String(ed.is_sold).toUpperCase() === 'TRUE';
                              return (
                                <motion.div
                                  key={String(ed.edition_number)}
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.4) }}
                                  className="flex items-center justify-between px-3 py-1.5"
                                >
                                  <span className="text-xs font-medium text-ink">#{ed.edition_number}</span>
                                  {isSold ? (
                                    <span className="text-[10px] text-ash">已售出</span>
                                  ) : (
                                    <span className="text-[10px] text-charcoal">
                                      {ed.location_category}{ed.location_detail ? `・${ed.location_detail}` : ''}
                                    </span>
                                  )}
                                </motion.div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="px-3 py-2 text-xs text-ash">找不到符合的作品。</p>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ══ Main form area ════════════════════════════════════ */}
          <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-5 no-scrollbar">

            {/* In / Out toggle */}
            <div className="flex rounded-sm border border-smoke overflow-hidden">
              {(['check-in', 'check-out'] as TxType[]).map((t) => {
                const isActive = txType === t;
                const Icon = t === 'check-in' ? ArrowDownCircle : ArrowUpCircle;
                return (
                  <button
                    key={t}
                    onClick={() => setTxType(t)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                      isActive ? 'bg-ink text-paper' : 'bg-paper text-charcoal hover:bg-mist'
                    }`}
                  >
                    <Icon size={15} />
                    {t === 'check-in' ? '入庫' : '出庫'}
                  </button>
                );
              })}
            </div>

            {/* Transfer / Sold sub-toggle */}
            {txType === 'check-out' && (
              <div className="flex rounded-sm border border-smoke overflow-hidden">
                {(['transfer', 'sold'] as OutSubtype[]).map((s) => {
                  const isActive = outSubtype === s;
                  const Icon = s === 'transfer' ? Building2 : Tag;
                  return (
                    <button
                      key={s}
                      onClick={() => setOutSubtype(s)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                        isActive ? 'bg-charcoal text-paper' : 'bg-paper text-ash hover:bg-mist'
                      }`}
                    >
                      <Icon size={12} />
                      {s === 'transfer' ? '移轉至畫廊' : '售出'}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Artwork selector */}
            <div className="space-y-1.5">
              <label className={lbl}>
                作品
                {hasActiveFilters && (
                  <span className="ml-1.5 normal-case tracking-normal font-normal text-ash">
                    （篩選中，共 {filteredArtworks.length} 件）
                  </span>
                )}
              </label>
              <select
                value={artworkId}
                onChange={(e) => setArtworkId(e.target.value)}
                className={inp}
              >
                <option value="" disabled>選擇作品…</option>
                {filteredArtworks.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} — {a.artist}
                    {a.category === '版畫' ? ' [版畫]' : ''}
                  </option>
                ))}
              </select>
              {selected && !isPrintmaking && (
                <p className="text-xs text-ash">
                  庫存：
                  <span className={`font-medium ${(selected.qty ?? 0) <= 0 ? 'text-red-500' : 'text-ink'}`}>
                    {selected.qty}
                  </span>
                </p>
              )}
            </div>

            {/* ── Check-in: Smart Source Pool ───────────────────── */}
            {txType === 'check-in' && artworkId && (
              <div className="space-y-1.5">
                <label className={lbl}>
                  來源
                  <span className="ml-1 normal-case tracking-normal font-normal text-ash">（從哪裡回來的）</span>
                </label>

                <div className="rounded-sm border border-smoke focus-within:border-charcoal transition-colors overflow-hidden">
                  {/* Quick-pick chip zone */}
                  {(sourcesLoading || quickSources.length > 0) && (
                    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5 bg-mist/40 border-b border-smoke/70">
                      {sourcesLoading ? (
                        <span className="text-[11px] text-ash animate-pulse">載入建議中…</span>
                      ) : (
                        <>
                          <span className="text-[10px] tracking-widest text-ash/50 uppercase shrink-0 mr-0.5">
                            快選
                          </span>
                          {quickSources.map((loc) => {
                            const active = sourceLocation === loc;
                            return (
                              <button
                                key={loc}
                                type="button"
                                onClick={() => setSourceLocation(active ? '' : loc)}
                                className={`inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-medium select-none transition-all duration-150 ${
                                  active
                                    ? 'bg-ink text-paper'
                                    : 'bg-white/90 text-charcoal border border-smoke hover:border-charcoal/60'
                                }`}
                              >
                                {loc}
                              </button>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}
                  {/* Freeform input */}
                  <input
                    value={sourceLocation}
                    onChange={(e) => setSourceLocation(e.target.value)}
                    placeholder={quickSources.length > 0 ? '或直接輸入…' : '輸入來源畫廊名稱…'}
                    className="w-full px-3 py-2.5 text-sm bg-paper text-ink placeholder:text-ash/60 outline-none"
                  />
                </div>
              </div>
            )}

            {/* ── Edition mode ──────────────────────────────────── */}
            {isPrintmaking && artworkId && (
              <div className="space-y-2">
                <label className={lbl}>
                  選擇版號
                  {selectedNums.length > 0 && (
                    <span className="ml-1.5 normal-case tracking-normal font-semibold text-ink">
                      （已選：{[...selectedNums]
                        .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))
                        .join(', ')} 號）
                    </span>
                  )}
                </label>

                {editionsLoading ? (
                  <p className="text-xs text-ash animate-pulse">載入版數中…</p>
                ) : availableEditions.length === 0 ? (
                  <p className="text-xs text-ash">
                    {txType === 'check-in' && sourceLocation
                      ? `「${sourceLocation}」目前無可入庫的版號。`
                      : txType === 'check-in'
                      ? '所有版次皆在家，無需入庫。'
                      : '沒有可操作的版號。'}
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {availableEditions.map((e, i) => {
                        const active   = selectedNums.includes(e.edition_number);
                        const locLabel = e.location_detail
                          ? `${e.location_category}・${e.location_detail}`
                          : e.location_category;
                        return (
                          <motion.button
                            key={String(e.edition_number)}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.5) }}
                            onClick={() => toggleEdition(e.edition_number)}
                            className={`flex flex-col items-center px-3 py-2 rounded-sm border text-xs transition-colors ${
                              active
                                ? 'bg-ink text-paper border-ink'
                                : 'bg-paper text-charcoal border-smoke hover:border-charcoal'
                            }`}
                          >
                            <span className="font-semibold">#{e.edition_number}</span>
                            <span className={`text-[10px] mt-0.5 ${active ? 'text-paper/70' : 'text-ash'}`}>
                              {locLabel}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                    {txType === 'check-out' && availableEditions.some((e) => {
                      const cat = String(e.location_category ?? '').trim();
                      return cat !== '' && cat !== '家裡' && cat !== '自家';
                    }) && (
                      <p className="text-[11px] text-charcoal bg-amber-50 border border-amber-100 rounded-sm px-2.5 py-1.5 leading-relaxed">
                        外部版次可直接售出或移轉，無需先移轉入庫。
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Legacy qty mode (non-print) ───────────────────── */}
            {!isPrintmaking && (
              <div className="space-y-1.5">
                <label className={lbl}>數量</label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={isOutOfStock}
                    className="w-9 h-9 rounded-sm border border-smoke flex items-center justify-center text-charcoal hover:bg-mist active:bg-smoke transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Decrease"
                  >
                    <span className="text-lg leading-none select-none">−</span>
                  </button>
                  <span className="w-12 text-center text-xl font-semibold tabular-nums text-ink">{qty}</span>
                  <button
                    onClick={() => setQty((q) => q + 1)}
                    disabled={isOutOfStock}
                    className="w-9 h-9 rounded-sm border border-smoke flex items-center justify-center text-charcoal hover:bg-mist active:bg-smoke transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Increase"
                  >
                    <span className="text-lg leading-none select-none">+</span>
                  </button>
                </div>
              </div>
            )}

            {/* ── Check-out fields ──────────────────────────────── */}
            {txType === 'check-out' && outSubtype === 'transfer' && (
              <div className="space-y-1.5">
                <label className={lbl}>移轉目的地</label>
                <input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="例：首都畫廊"
                  className={inp}
                />
              </div>
            )}

            {txType === 'check-out' && outSubtype === 'sold' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className={lbl}>買家名稱</label>
                  <input
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="例：王小明"
                    className={inp}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={lbl}>
                    成交價格（NT$）
                    <span className="normal-case tracking-normal font-normal text-ash ml-1">選填</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={soldPrice}
                    onChange={(e) => setSoldPrice(e.target.value)}
                    placeholder={
                      selected?.price
                        ? `定價 NT$${Number(selected.price).toLocaleString()}`
                        : '例：80000'
                    }
                    className={inp}
                  />
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <label className={lbl}>
                備註
                <span className="normal-case tracking-normal font-normal text-ash ml-1">（選填）</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="任何備註…"
                className={`${inp} resize-none`}
              />
            </div>

            {/* Feedback */}
            {feedback && (
              <p className={`text-sm text-center py-2 rounded-sm ${
                feedback.ok ? 'bg-ink/5 text-ink' : 'bg-red-50 text-red-600'
              }`}>
                {feedback.msg}
              </p>
            )}

            {/* Zero-stock / no-edition guard */}
            {isOutOfStock && (
              <p className="text-sm text-center font-medium text-red-600">庫存為 0，無法出庫</p>
            )}
            {isPrintNoEditions && (
              <p className="text-sm text-center font-medium text-red-600">無可出庫的版號</p>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!artworkId || isSubmitting || isOutOfStock || isPrintNoEditions}
              className="w-full bg-ink text-paper py-3 rounded-sm text-sm font-semibold tracking-wide disabled:opacity-40 disabled:cursor-not-allowed hover:bg-charcoal active:scale-[0.98] transition-all"
            >
              {isSubmitting ? '記錄中…' : submitLabel}
            </button>
          </div>

        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

const inp = 'w-full border border-smoke rounded-sm bg-paper px-3 py-2.5 text-sm text-ink placeholder-ash focus:outline-none focus:ring-1 focus:ring-ink';
const lbl = 'text-[10px] uppercase tracking-widest font-medium text-ash block';
const pill = (active: boolean) =>
  `h-7 px-3 rounded-full text-xs font-medium border transition-all duration-150 ${
    active
      ? 'bg-ink text-paper border-ink'
      : 'bg-paper text-charcoal border-smoke hover:border-charcoal/60'
  }`;
