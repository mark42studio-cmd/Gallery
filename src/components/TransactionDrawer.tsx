import { useState } from 'react';
import { Drawer } from 'vaul';
import { Minus, Plus, X, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import type { Artwork, LiffUser } from '../types';
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

export default function TransactionDrawer({
  open,
  onClose,
  artworks,
  user,
  initialArtwork,
  onSuccess,
}: Props) {
  const [txType, setTxType] = useState<TxType>('check-in');
  const [artworkId, setArtworkId] = useState(initialArtwork?.id ?? '');
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const adjustQty = (delta: number) => setQty((q) => Math.max(1, q + delta));

  async function handleSubmit() {
    if (!artworkId || !user) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const fn = txType === 'check-in' ? api.checkIn : api.checkOut;
      const res = await fn(artworkId, qty, user.userId, user.displayName, notes);
      if (res.success) {
        setFeedback({ ok: true, msg: res.message ?? '交易已記錄。' });
        onSuccess();
        setTimeout(() => {
          onClose();
          setFeedback(null);
          setQty(1);
          setNotes('');
        }, 1200);
      } else {
        setFeedback({ ok: false, msg: res.error ?? '交易失敗。' });
      }
    } catch (err) {
      setFeedback({ ok: false, msg: err instanceof Error ? err.message : '網路錯誤。' });
    } finally {
      setIsSubmitting(false);
    }
  }

  const selected = artworks.find((a) => a.id === artworkId);

  return (
    <Drawer.Root open={open} onOpenChange={(v) => !v && onClose()} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm" />
        <Drawer.Content className="fixed bottom-0 inset-x-0 z-50 flex flex-col rounded-t-2xl bg-paper shadow-drawer focus:outline-none">
          {/* drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-smoke" />
          </div>

          <div className="px-5 pb-2 flex items-center justify-between">
            <Drawer.Title className="font-display text-lg font-semibold">
              進出庫記錄
            </Drawer.Title>
            <button onClick={onClose} className="p-1 text-ash hover:text-ink transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="px-5 pb-8 space-y-5 overflow-y-auto no-scrollbar">
            {/* Type toggle */}
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

            {/* Artwork selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-charcoal uppercase tracking-widest">
                作品
              </label>
              <select
                value={artworkId}
                onChange={(e) => setArtworkId(e.target.value)}
                className="w-full border border-smoke rounded-sm bg-paper px-3 py-2.5 text-sm text-ink appearance-none focus:outline-none focus:ring-1 focus:ring-ink"
              >
                <option value="" disabled>選擇作品…</option>
                {artworks.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} — {a.artist}
                  </option>
                ))}
              </select>
              {selected && (
                <p className="text-xs text-ash">
                  目前數量：<span className="text-ink font-medium">{selected.qty}</span>
                  {' · '}
                  <span className={selected.status === 'in-stock' ? 'text-ink' : 'text-ash'}>
                    {selected.status === 'in-stock' ? '在庫' : '已出庫'}
                  </span>
                </p>
              )}
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-charcoal uppercase tracking-widest">
                數量
              </label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => adjustQty(-1)}
                  className="w-9 h-9 rounded-sm border border-smoke flex items-center justify-center text-charcoal hover:bg-mist active:bg-smoke transition-colors"
                >
                  <Minus size={14} />
                </button>
                <span className="w-12 text-center text-xl font-semibold tabular-nums text-ink">
                  {qty}
                </span>
                <button
                  onClick={() => adjustQty(1)}
                  className="w-9 h-9 rounded-sm border border-smoke flex items-center justify-center text-charcoal hover:bg-mist active:bg-smoke transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-charcoal uppercase tracking-widest">
                備註{' '}
                <span className="normal-case tracking-normal text-ash font-normal">（選填）</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="任何備註…"
                className="w-full border border-smoke rounded-sm bg-paper px-3 py-2 text-sm text-ink placeholder-ash resize-none focus:outline-none focus:ring-1 focus:ring-ink"
              />
            </div>

            {/* Feedback */}
            {feedback && (
              <p
                className={`text-sm text-center py-2 rounded-sm ${
                  feedback.ok ? 'bg-ink/5 text-ink' : 'bg-red-50 text-red-600'
                }`}
              >
                {feedback.msg}
              </p>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!artworkId || isSubmitting}
              className="w-full bg-ink text-paper py-3 rounded-sm text-sm font-semibold tracking-wide disabled:opacity-40 disabled:cursor-not-allowed hover:bg-charcoal active:scale-[0.98] transition-all"
            >
              {isSubmitting ? '記錄中…' : `確認${txType === 'check-in' ? '入庫' : '出庫'}`}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
