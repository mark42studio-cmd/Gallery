import { useState, useEffect } from 'react';
import { Drawer } from 'vaul';
import { X, ArrowDownCircle, ArrowUpCircle, Building2, Tag } from 'lucide-react';
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

type TxType = 'check-in' | 'check-out';
type OutSubtype = 'transfer' | 'sold';

const QUICK_DESTINATIONS = ['家裡', '首都畫廊', '双方藝廊'];

export default function TransactionDrawer({
  open, onClose, artworks, user, initialArtwork, onSuccess,
}: Props) {
  const [txType, setTxType]             = useState<TxType>('check-in');
  const [outSubtype, setOutSubtype]     = useState<OutSubtype>('transfer');
  const [artworkId, setArtworkId]       = useState('');
  // Legacy qty mode
  const [qty, setQty]                   = useState(1);
  // Edition mode
  const [editions, setEditions]         = useState<Edition[]>([]);
  const [editionsLoading, setEditionsLoading] = useState(false);
  const [selectedNums, setSelectedNums] = useState<(number | string)[]>([]);
  const [destination, setDestination]   = useState('家裡');
  const [buyerName, setBuyerName]       = useState('');
  const [soldPrice, setSoldPrice]       = useState('');

  const [notes, setNotes]               = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback]         = useState<{ ok: boolean; msg: string } | null>(null);

  const selected    = artworks.find((a) => a.id === artworkId);
  const isPrintmaking = selected?.category === '版畫';

  // Reset and initialise every time the drawer opens
  useEffect(() => {
    if (!open) return;
    setArtworkId(initialArtwork?.id ?? '');
    setTxType('check-in');
    setOutSubtype('transfer');
    setQty(1);
    setEditions([]);
    setSelectedNums([]);
    setDestination('家裡');
    setBuyerName('');
    setSoldPrice('');
    setNotes('');
    setFeedback(null);
  }, [open, initialArtwork?.id]);

  // Fetch editions whenever a printmaking artwork is chosen
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
  }, [artworkId, isPrintmaking]);

  // Reset selection when transaction type changes
  useEffect(() => {
    setSelectedNums([]);
    setDestination(txType === 'check-in' ? '家裡' : '');
  }, [txType]);

  // --- helpers ---

  function toggleEdition(num: number | string) {
    setSelectedNums((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num],
    );
  }

  // Editions eligible for this operation
  const availableEditions = editions.filter((e) => {
    if (txType === 'check-in') return !e.is_sold && e.location_category !== '家裡';
    return !e.is_sold; // transfer / sold: anything not already sold
  });

  // --- submit ---

  async function handleSubmit() {
    if (!artworkId || !user) return;

    if (isPrintmaking) {
      if (selectedNums.length === 0) {
        setFeedback({ ok: false, msg: '請選擇至少一件版號。' });
        return;
      }
      if (txType === 'check-out' && outSubtype === 'transfer' && !destination.trim()) {
        setFeedback({ ok: false, msg: '請填寫移轉目的地。' });
        return;
      }
      if (txType === 'check-out' && outSubtype === 'sold' && !buyerName.trim()) {
        setFeedback({ ok: false, msg: '請填寫買家名稱。' });
        return;
      }
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      let res;
      if (isPrintmaking) {
        const effectiveDestination =
          txType === 'check-in'
            ? destination || '家裡'
            : outSubtype === 'transfer'
            ? destination
            : buyerName;

        res = await api.editionTransaction({
          artworkId,
          editionNumbers: selectedNums,
          txType,
          outSubtype: txType === 'check-out' ? outSubtype : undefined,
          destination: effectiveDestination,
          soldPrice: txType === 'check-out' && outSubtype === 'sold' && soldPrice
            ? Number(soldPrice)
            : undefined,
          userId: user.userId,
          userName: user.displayName,
          notes,
        });
      } else {
        const fn = txType === 'check-in' ? api.checkIn : api.checkOut;
        res = await fn(artworkId, qty, user.userId, user.displayName, notes);
      }

      if (res.success) {
        setFeedback({ ok: true, msg: res.message ?? '交易已記錄。' });
        onSuccess();
        setTimeout(onClose, 1200);
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

  return (
    <Drawer.Root open={open} onOpenChange={(v) => !v && onClose()} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm" />
        <Drawer.Content className="fixed bottom-0 inset-x-0 z-50 flex flex-col rounded-t-2xl bg-paper shadow-drawer focus:outline-none max-h-[92vh]">
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-smoke" />
          </div>

          <div className="px-5 pb-2 flex items-center justify-between shrink-0">
            <Drawer.Title className="font-display text-lg font-semibold">進出庫記錄</Drawer.Title>
            <button onClick={onClose} className="p-1 text-ash hover:text-ink transition-colors">
              <X size={18} />
            </button>
          </div>

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

            {/* Transfer / Sold sub-toggle (出庫 only) */}
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
              <label className={lbl}>作品</label>
              <select
                value={artworkId}
                onChange={(e) => setArtworkId(e.target.value)}
                className={inp}
              >
                <option value="" disabled>選擇作品…</option>
                {artworks.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} — {a.artist}
                    {a.category === '版畫' ? ' [版畫]' : ''}
                  </option>
                ))}
              </select>
              {selected && !isPrintmaking && (
                <p className="text-xs text-ash">
                  庫存：<span className="text-ink font-medium">{selected.qty}</span>
                </p>
              )}
            </div>

            {/* ── EDITION MODE ─────────────────────────────────── */}
            {isPrintmaking && artworkId && (
              <>
                {/* Edition picker */}
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
                    <p className="text-xs text-ash">沒有可操作的版號。</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {availableEditions.map((e) => {
                        const active  = selectedNums.includes(e.edition_number);
                        const locLabel = e.location_detail
                          ? `${e.location_category}・${e.location_detail}`
                          : e.location_category;
                        return (
                          <button
                            key={e.edition_number}
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
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Destination — check-in or transfer */}
                {(txType === 'check-in' || (txType === 'check-out' && outSubtype === 'transfer')) && (
                  <div className="space-y-2">
                    <label className={lbl}>
                      {txType === 'check-in' ? '入庫目的地' : '移轉目的地'}
                    </label>
                    {txType === 'check-in' && (
                      <div className="flex gap-2 flex-wrap">
                        {QUICK_DESTINATIONS.map((loc) => (
                          <button
                            key={loc}
                            onClick={() => setDestination(loc)}
                            className={`text-xs px-3 py-1.5 rounded-sm border transition-colors ${
                              destination === loc
                                ? 'bg-ink text-paper border-ink'
                                : 'bg-paper text-ash border-smoke hover:border-charcoal'
                            }`}
                          >
                            {loc}
                          </button>
                        ))}
                      </div>
                    )}
                    <input
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder={txType === 'check-in' ? '或輸入自訂位置…' : '例：首都畫廊'}
                      className={inp}
                    />
                  </div>
                )}

                {/* Sold fields */}
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
              </>
            )}

            {/* ── LEGACY QTY MODE ─────────────────────────────── */}
            {!isPrintmaking && (
              <div className="space-y-1.5">
                <label className={lbl}>數量</label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="w-9 h-9 rounded-sm border border-smoke flex items-center justify-center text-charcoal hover:bg-mist active:bg-smoke transition-colors"
                    aria-label="Decrease"
                  >
                    <span className="text-lg leading-none select-none">−</span>
                  </button>
                  <span className="w-12 text-center text-xl font-semibold tabular-nums text-ink">{qty}</span>
                  <button
                    onClick={() => setQty((q) => q + 1)}
                    className="w-9 h-9 rounded-sm border border-smoke flex items-center justify-center text-charcoal hover:bg-mist active:bg-smoke transition-colors"
                    aria-label="Increase"
                  >
                    <span className="text-lg leading-none select-none">+</span>
                  </button>
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

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!artworkId || isSubmitting}
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
