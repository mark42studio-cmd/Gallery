import { useState, useMemo } from 'react';
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
  const [artist, setArtist] = useState('');
  const [percentage, setPercentage] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const artists = useMemo(() => [...new Set(artworks.map(a => a.artist))].sort(), [artworks]);

  const preview = useMemo(
    () => artworks.filter(a => a.artist === artist && Number(a.price) > 0),
    [artworks, artist]
  );

  function previewPrice(price: number | '') {
    const pct = Number(percentage);
    if (!percentage || isNaN(pct)) return null;
    return Math.round(Number(price) * (1 + pct / 100));
  }

  async function handleBulkUpdate() {
    if (!artist || !percentage || !reason.trim()) {
      setFeedback({ ok: false, msg: '請選擇藝術家、填寫調整比例與調整原因。' });
      return;
    }
    const pct = Number(percentage);
    if (isNaN(pct) || pct <= -100) {
      setFeedback({ ok: false, msg: '請輸入有效百分比 (e.g. 10 or -5)。' });
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const res = await api.bulkUpdatePrices(artist, pct, reason.trim(), user?.userId ?? '', user?.displayName ?? '');
      if (!res.success) throw new Error(res.error);
      setFeedback({ ok: true, msg: `已成功更新 ${res.data?.updated ?? 0} 件作品的定價。` });
      setArtist('');
      setPercentage('');
      setReason('');
      onSuccess();
    } catch (err) {
      setFeedback({ ok: false, msg: err instanceof Error ? err.message : '操作失敗' });
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setFeedback(null);
    onClose();
  }

  return (
    <Drawer.Root open={open} onOpenChange={(v) => !v && handleClose()} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm" />
        <Drawer.Content className="fixed bottom-0 inset-x-0 z-50 flex flex-col rounded-t-2xl bg-paper shadow-drawer focus:outline-none max-h-[88vh]">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-smoke" />
          </div>

          <div className="px-5 pb-2 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <BarChart2 size={16} className="text-ash" />
              <Drawer.Title className="font-display text-lg font-semibold text-ink">批量調整定價</Drawer.Title>
            </div>
            <button onClick={handleClose} className="p-1 text-ash hover:text-ink transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-4 no-scrollbar">
            {/* Artist selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-ash font-medium">選擇藝術家</label>
              <select value={artist} onChange={e => setArtist(e.target.value)}
                className="w-full px-3 py-2 border border-smoke rounded-sm bg-paper text-sm text-ink focus:outline-none focus:ring-1 focus:ring-ink">
                <option value="">— 選擇藝術家 —</option>
                {artists.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* Percentage input */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-ash font-medium">調整比例</label>
              <div className="relative">
                <input type="number" value={percentage}
                  onChange={e => setPercentage(e.target.value)}
                  placeholder="e.g. 10 (漲10%) 或 -5 (降5%)"
                  className="w-full px-3 py-2 pr-8 border border-smoke rounded-sm bg-paper text-sm text-ink placeholder-ash focus:outline-none focus:ring-1 focus:ring-ink" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ash text-sm">%</span>
              </div>
            </div>

            {/* Reason — required for audit trail */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-ash font-medium">調整原因 *</label>
              <input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. 年度市場調漲、展後定價"
                className="w-full px-3 py-2 border border-smoke rounded-sm bg-paper text-sm text-ink placeholder-ash focus:outline-none focus:ring-1 focus:ring-ink"
              />
            </div>

            {/* Preview */}
            {artist && preview.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] text-ash uppercase tracking-widest">
                  預覽 — {artist} 共 {preview.length} 件有定價的作品
                </p>
                {preview.map(a => {
                  const np = previewPrice(a.price ?? '');
                  const current = Number(a.price);
                  return (
                    <div key={a.id} className="flex items-center justify-between p-2.5 border border-smoke rounded-sm">
                      <p className="text-sm text-ink truncate flex-1 mr-2">{a.title}</p>
                      <div className="flex items-center gap-1.5 shrink-0 text-xs">
                        <span className="text-ash">NT${current.toLocaleString()}</span>
                        {np !== null && (
                          <>
                            <span className="text-smoke">→</span>
                            <span className={np > current ? 'text-green-600 font-medium' : np < current ? 'text-red-500 font-medium' : 'text-ash'}>
                              NT${np.toLocaleString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {artist && preview.length === 0 && (
              <p className="text-sm text-ash text-center py-6 border border-smoke rounded-sm">
                {artist} 的作品中無定價資料可調整。
              </p>
            )}

            {feedback && (
              <p className={`text-sm text-center py-2 rounded-sm ${feedback.ok ? 'bg-ink/5 text-ink' : 'bg-red-50 text-red-600'}`}>
                {feedback.msg}
              </p>
            )}
          </div>

          <div className="px-5 py-4 border-t border-smoke shrink-0">
            <button
              onClick={handleBulkUpdate}
              disabled={loading || !artist || !percentage || !reason.trim() || preview.length === 0}
              className="w-full bg-ink text-paper py-3 rounded-sm text-sm font-semibold tracking-wide disabled:opacity-40 hover:bg-charcoal active:scale-[0.98] transition-all"
            >
              {loading ? '處理中…' : `確認調整${artist ? ` ${artist}` : ''} 的定價`}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
