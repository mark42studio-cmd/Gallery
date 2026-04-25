import { useState, useEffect } from 'react';
import { Drawer } from 'vaul';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { Artwork, LiffUser, PriceHistory } from '../types';
import { api } from '../services/api';

interface Props {
  open: boolean;
  onClose: () => void;
  artwork: Artwork | null;
  user: LiffUser | null;
  onSuccess: () => void;
}

export default function PriceDrawer({ open, onClose, artwork, user, onSuccess }: Props) {
  const [history, setHistory] = useState<PriceHistory[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!open || !artwork) return;
    setNewPrice(artwork.price != null && artwork.price !== '' ? String(artwork.price) : '');
    setReason('');
    setFeedback(null);
    fetchHistory(artwork.id);
  }, [open, artwork]);

  async function fetchHistory(id: string) {
    setHistLoading(true);
    try {
      const res = await api.getPriceHistory(id);
      if (res.success && res.data) {
        setHistory([...res.data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      }
    } catch (_) {
      // silently ignore
    } finally {
      setHistLoading(false);
    }
  }

  async function handleUpdate() {
    if (!artwork) return;
    if (!newPrice || !reason.trim()) {
      setFeedback({ ok: false, msg: '請填寫新定價與原因。' });
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const res = await api.updatePrice(
        artwork.id, Number(newPrice), reason,
        user?.userId ?? '', user?.displayName ?? ''
      );
      if (!res.success) throw new Error(res.error);
      setFeedback({ ok: true, msg: '定價已更新。' });
      setReason('');
      onSuccess();
      fetchHistory(artwork.id);
    } catch (err) {
      setFeedback({ ok: false, msg: err instanceof Error ? err.message : '更新失敗' });
    } finally {
      setLoading(false);
    }
  }

  const fmtPrice = (p: number | '') => p !== '' ? `NT$ ${Number(p).toLocaleString()}` : '—';
  const fmtDate  = (d: string) => new Date(d).toLocaleDateString('zh-TW', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <Drawer.Root open={open} onOpenChange={(v) => !v && onClose()} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm" />
        <Drawer.Content className="fixed bottom-0 inset-x-0 z-50 flex flex-col rounded-t-2xl bg-paper shadow-drawer focus:outline-none max-h-[88vh]">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-smoke" />
          </div>

          <div className="px-5 pb-2 flex items-center justify-between shrink-0">
            <div>
              <Drawer.Title className="font-display text-lg font-semibold text-ink">定價管理</Drawer.Title>
              {artwork && <p className="text-xs text-ash mt-0.5">{artwork.title} · {artwork.artist}</p>}
            </div>
            <button onClick={onClose} className="p-1 text-ash hover:text-ink transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar">
            {/* Current price display */}
            {artwork && (
              <div className="px-5 py-4 border-b border-smoke">
                <p className="text-[10px] text-ash uppercase tracking-widest mb-1">目前定價</p>
                <p className="font-display text-2xl font-semibold text-ink">
                  {fmtPrice(artwork.price ?? '')}
                </p>
              </div>
            )}

            {/* Update form */}
            <div className="px-5 py-4 space-y-3 border-b border-smoke">
              <p className="text-[10px] text-ash uppercase tracking-widest">更新定價</p>
              <div className="space-y-1.5">
                <label className="text-[10px] text-ash uppercase tracking-widest font-medium">新定價 (NT$)</label>
                <input type="number" min={0} value={newPrice}
                  onChange={e => setNewPrice(e.target.value)}
                  placeholder="輸入新定價"
                  className="w-full px-3 py-2 border border-smoke rounded-sm bg-paper text-sm text-ink placeholder-ash focus:outline-none focus:ring-1 focus:ring-ink" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-ash uppercase tracking-widest font-medium">原因 *</label>
                <input value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="e.g. 展後調漲、季節促銷"
                  className="w-full px-3 py-2 border border-smoke rounded-sm bg-paper text-sm text-ink placeholder-ash focus:outline-none focus:ring-1 focus:ring-ink" />
              </div>
              {feedback && (
                <p className={`text-sm py-2 rounded-sm text-center ${feedback.ok ? 'bg-ink/5 text-ink' : 'bg-red-50 text-red-600'}`}>
                  {feedback.msg}
                </p>
              )}
              <button
                onClick={handleUpdate}
                disabled={loading || !newPrice || !reason.trim()}
                className="w-full bg-ink text-paper py-2.5 rounded-sm text-sm font-semibold tracking-wide disabled:opacity-40 hover:bg-charcoal active:scale-[0.98] transition-all"
              >
                {loading ? '處理中…' : '確認更新'}
              </button>
            </div>

            {/* Price history */}
            <div className="px-5 py-4">
              <p className="text-[10px] text-ash uppercase tracking-widest mb-3">價格異動紀錄</p>
              {histLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-14 bg-mist rounded-sm animate-pulse" />)}
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-ash text-center py-8">尚無價格異動紀錄</p>
              ) : (
                <div className="space-y-2">
                  {history.map((h) => {
                    const diff = Number(h.newPrice) - Number(h.oldPrice);
                    const Icon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
                    const color = diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-ash';
                    return (
                      <div key={h.id} className="flex items-start gap-3 p-3 border border-smoke rounded-sm">
                        <Icon size={14} className={`mt-0.5 shrink-0 ${color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-ink">
                              {fmtPrice(h.oldPrice)} → {fmtPrice(h.newPrice)}
                            </p>
                            <span className={`text-xs font-semibold shrink-0 ${color}`}>
                              {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                            </span>
                          </div>
                          <p className="text-[10px] text-ash mt-0.5 truncate">{h.reason}</p>
                          <p className="text-[10px] text-ash/70">{fmtDate(h.date)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
