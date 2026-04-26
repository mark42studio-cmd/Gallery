import { useState, useMemo, useEffect } from 'react';
import { Drawer } from 'vaul';
import { X, BarChart2 } from 'lucide-react';
import type { Artwork, LiffUser } from '../types';
import { api } from '../services/api';

interface Props {
  open: boolean;
  onClose: () => void;
  artworks: Artwork[];
  user: LiffUser | null;
  onSuccess: () => void;
}

export default function BulkPriceDrawer({ open, onClose, artworks, user, onSuccess }: Props) {
  const [artist, setArtist]     = useState('');
  const [percentage, setPercentage] = useState('');
  const [reason, setReason]     = useState('');
  const [prices, setPrices]     = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const artists = useMemo(() => [...new Set(artworks.map(a => a.artist))].sort(), [artworks]);

  const preview = useMemo(
    () => artworks.filter(a => a.artist === artist && Number(a.price) > 0),
    [artworks, artist],
  );

  // Re-initialise editable prices whenever the artist selection changes
  useEffect(() => {
    const init: Record<string, string> = {};
    preview.forEach(a => { init[a.id] = String(Number(a.price)); });
    setPrices(init);
    setPercentage('');
  }, [preview]);

  // Batch-percentage handler: recalculate ALL rows from originals
  function handlePctChange(val: string) {
    setPercentage(val);
    const pct = parseFloat(val);
    const next: Record<string, string> = {};
    preview.forEach(a => {
      next[a.id] = (!val || isNaN(pct))
        ? String(Number(a.price))
        : String(Math.round(Number(a.price) * (1 + pct / 100)));
    });
    setPrices(next);
  }

  function handlePriceChange(id: string, val: string) {
    setPrices(prev => ({ ...prev, [id]: val }));
  }

  async function handleSubmit() {
    if (!artist || !reason.trim()) {
      const msg = '請選擇藝術家並填寫調整原因。';
      setFeedback({ ok: false, msg });
      alert(msg);
      return;
    }
    const updates = preview
      .map(a => ({ id: a.id, newPrice: Math.round(parseFloat(prices[a.id] ?? '0')) }))
      .filter(u => u.newPrice > 0 && u.newPrice !== Number(artworks.find(a => a.id === u.id)?.price));

    if (updates.length === 0) {
      const msg = '沒有任何定價有變動，請先調整後再提交。';
      setFeedback({ ok: false, msg });
      alert(msg);
      return;
    }

    console.log('Submitting pricing updates...', updates);
    setLoading(true);
    setFeedback(null);
    try {
      const res = await api.granularUpdatePrices(updates, reason.trim(), user?.userId ?? '', user?.displayName ?? '');
      if (!res.success) throw new Error(res.error);
      const successMsg = `已成功更新 ${res.data?.updated ?? updates.length} 件作品的定價。`;
      setFeedback({ ok: true, msg: successMsg });
      alert(successMsg);
      setArtist('');
      setPercentage('');
      setReason('');
      setPrices({});
      onSuccess();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '操作失敗';
      setFeedback({ ok: false, msg: errMsg });
      alert(`操作失敗：${errMsg}`);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setFeedback(null);
    onClose();
  }

  const canSubmit = !loading && !!artist && preview.length > 0;

  return (
    <Drawer.Root open={open} onOpenChange={(v) => !v && handleClose()} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm" />
        <Drawer.Content aria-describedby={undefined} className="fixed bottom-0 inset-x-0 z-50 flex flex-col rounded-t-2xl bg-paper shadow-drawer focus:outline-none max-h-[92vh]">

          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-smoke" />
          </div>

          {/* Header */}
          <div className="px-5 pb-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <BarChart2 size={16} className="text-ash" />
              <Drawer.Title className="font-display text-lg font-semibold text-ink">定價管理</Drawer.Title>
            </div>
            <button onClick={handleClose} className="p-1 text-ash hover:text-ink transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-5 no-scrollbar">

            {/* ── Artist selector ── */}
            <div className="space-y-1.5">
              <label className={LABEL}>選擇藝術家</label>
              <select
                value={artist}
                onChange={e => setArtist(e.target.value)}
                className={INPUT}
              >
                <option value="">— 選擇藝術家 —</option>
                {artists.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* ── Batch-percentage ── */}
            <div className="space-y-1.5">
              <label className={LABEL}>
                批量調整比例
                <span className="ml-1 text-ash font-normal normal-case tracking-normal">（選填，輸入後即時更新下方所有定價）</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={percentage}
                  onChange={e => handlePctChange(e.target.value)}
                  placeholder="e.g. 10 （漲10%）或 -5 （降5%）"
                  className={`${INPUT} pr-8`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ash text-sm pointer-events-none">%</span>
              </div>
            </div>

            {/* ── Reason ── */}
            <div className="space-y-1.5">
              <label className={LABEL}>調整原因 *</label>
              <input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. 年度市場調漲、展後定價"
                className={INPUT}
              />
            </div>

            {/* ── Artwork price rows ── */}
            {preview.length > 0 && (
              <div className="space-y-1">
                <p className={`${LABEL} mb-2`}>
                  個別定價 — {artist}・{preview.length} 件
                </p>

                <div className="border border-smoke rounded-sm divide-y divide-smoke/60">
                  {preview.map(a => {
                    const origPrice = Number(a.price);
                    const newPrice  = parseFloat(prices[a.id] ?? '');
                    const delta     = isNaN(newPrice) ? 0 : newPrice - origPrice;
                    const deltaPct  = origPrice > 0 ? (delta / origPrice) * 100 : 0;
                    const changed   = !isNaN(newPrice) && Math.round(newPrice) !== origPrice;

                    return (
                      <div key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                        {/* Title + original price */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-ink font-medium leading-snug truncate">{a.title}</p>
                          <p className="text-[10px] text-ash mt-0.5 tabular-nums">
                            原 NT${origPrice.toLocaleString()}
                          </p>
                        </div>

                        {/* Delta badge */}
                        <span className={`text-[10px] tabular-nums w-12 text-right shrink-0 font-medium ${
                          !changed ? 'text-transparent' :
                          delta > 0 ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                          {changed ? `${delta > 0 ? '+' : ''}${deltaPct.toFixed(1)}%` : '—'}
                        </span>

                        {/* Editable price input */}
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-ash">NT$</span>
                          <input
                            type="number"
                            min={0}
                            value={prices[a.id] ?? ''}
                            onChange={e => handlePriceChange(a.id, e.target.value)}
                            className={`w-28 text-right border rounded-sm px-2 py-1.5 text-sm font-medium tabular-nums focus:outline-none focus:ring-1 transition-colors ${
                              !changed
                                ? 'border-smoke text-ink bg-paper focus:ring-ink'
                                : delta > 0
                                ? 'border-emerald-200 text-emerald-700 bg-emerald-50/50 focus:ring-emerald-400'
                                : 'border-red-200 text-red-600 bg-red-50/50 focus:ring-red-400'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {artist && preview.length === 0 && (
              <p className="text-sm text-ash text-center py-8 border border-smoke rounded-sm">
                {artist} 的作品中無定價資料可調整。
              </p>
            )}

            {/* Feedback */}
            {feedback && (
              <p className={`text-sm text-center py-2.5 rounded-sm ${
                feedback.ok ? 'bg-ink/5 text-ink' : 'bg-red-50 text-red-600'
              }`}>
                {feedback.msg}
              </p>
            )}
          </div>

          {/* Footer CTA */}
          <div className="px-5 py-4 border-t border-smoke shrink-0">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full bg-ink text-paper py-3 rounded-sm text-sm font-semibold tracking-wide disabled:opacity-40 hover:bg-charcoal active:scale-[0.98] transition-all"
            >
              {loading ? '處理中…' : artist ? `確認更新 ${artist} 的定價` : '確認更新定價'}
            </button>
          </div>

        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

const LABEL = 'block text-[10px] uppercase tracking-widest text-ash font-medium';
const INPUT  = 'w-full px-3 py-2 border border-smoke rounded-sm bg-paper text-sm text-ink placeholder-ash focus:outline-none focus:ring-1 focus:ring-ink';
