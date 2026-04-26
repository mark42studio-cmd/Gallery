import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';
import type { LiffUser, PreparedTx } from '../types';
import { api } from '../services/api';

interface Props {
  user: LiffUser | null;
  onSuccess: () => void;
}

interface ChatMessage {
  role: 'user' | 'ai';
  text?: string;
  ok?: boolean;
  pending?: PreparedTx;
  done?: boolean;
  cancelled?: boolean;
}

export default function AiCommandFab({ user, onSuccess }: Props) {
  const [open, setOpen]         = useState(false);
  const [command, setCommand]   = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const textareaRef   = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 100);
    else { setCommand(''); setMessages([]); }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  async function handleSend() {
    if (!command.trim() || !user || isLoading) return;
    const userText = command.trim();
    setCommand('');
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);
    try {
      const res = await api.aiCommand(userText, user.userId, user.displayName);
      const data = res.data as { intent?: string; prepared?: PreparedTx; message?: string } | undefined;

      if (res.success && data?.intent === 'PREPARE_TRANSACTION' && data.prepared) {
        setMessages((prev) => [...prev, { role: 'ai', pending: data.prepared }]);
      } else if (res.success && data?.message) {
        setMessages((prev) => [...prev, { role: 'ai', text: data.message, ok: true }]);
        onSuccess();
      } else {
        setMessages((prev) => [...prev, { role: 'ai', text: res.error ?? 'Command failed.', ok: false }]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: err instanceof Error ? err.message : 'Network error.', ok: false },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }

  function handleCancel(idx: number) {
    setMessages((prev) => prev.map((m, i) => i === idx ? { ...m, cancelled: true } : m));
  }

  async function handleConfirm(
    idx: number,
    extra: { buyerName?: string; soldPrice?: string; destination?: string },
  ) {
    const msg = messages[idx];
    if (!msg.pending) return;
    const { artworkId, action, qty, outSubtype, userId, userName, notes } = msg.pending;
    try {
      const res = await api.executeConfirmedTransaction({
        artworkId,
        txAction: action,
        qty,
        outSubtype:  outSubtype  ?? undefined,
        destination: extra.destination || undefined,
        buyerName:   extra.buyerName   || undefined,
        soldPrice:   extra.soldPrice   ? Number(extra.soldPrice) : undefined,
        userId, userName, notes,
      });
      const resultText = res.success
        ? ((res.data as { message?: string })?.message ?? '交易已完成。')
        : (res.error ?? '交易失敗。');
      setMessages((prev) => prev.map((m, i) =>
        i === idx ? { ...m, pending: undefined, done: true, text: resultText, ok: res.success } : m
      ));
      if (res.success) onSuccess();
    } catch (err) {
      const errText = err instanceof Error ? err.message : '網路錯誤。';
      setMessages((prev) => prev.map((m, i) =>
        i === idx ? { ...m, pending: undefined, done: true, text: errText, ok: false } : m
      ));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend();
  }

  const EXAMPLES = ['庫存裡有草間彌生的作品嗎？', '剛賣出 2 件蒙娜麗莎', '入庫 5 件星夜'];

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 inset-x-4 z-50 bg-paper rounded-xl shadow-lifted border border-smoke animate-slide-up flex flex-col max-h-[70vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-ink" />
              <span className="font-display text-base font-semibold">AI 助理</span>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 text-ash hover:text-ink">
              <X size={16} />
            </button>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-3 min-h-0">
            {messages.length === 0 && (
              <p className="text-xs text-ash py-1">用自然語言描述庫存操作，或詢問作品資訊。</p>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex items-end gap-1.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'ai' && (
                  <div className="w-5 h-5 rounded-full bg-ink flex items-center justify-center shrink-0 mb-0.5">
                    <Sparkles size={10} className="text-paper" />
                  </div>
                )}

                {/* ── Pending confirmation card ── */}
                {msg.role === 'ai' && msg.pending && !msg.done && !msg.cancelled ? (
                  <ConfirmCard
                    pending={msg.pending}
                    onConfirm={(extra) => handleConfirm(i, extra)}
                    onCancel={() => handleCancel(i)}
                  />
                ) : msg.role === 'ai' && msg.pending && msg.cancelled ? (
                  <div className="max-w-[80%] rounded-xl px-3 py-2 text-sm bg-mist text-ash border border-smoke rounded-bl-sm">
                    已取消。
                  </div>
                ) : msg.text ? (
                  <div
                    className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-ink text-paper rounded-br-sm'
                        : msg.ok === false
                        ? 'bg-red-50 text-red-600 border border-red-100 rounded-bl-sm'
                        : 'bg-mist text-ink border border-smoke rounded-bl-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                ) : null}
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex items-end gap-1.5 justify-start">
                <div className="w-5 h-5 rounded-full bg-ink flex items-center justify-center shrink-0 mb-0.5">
                  <Sparkles size={10} className="text-paper" />
                </div>
                <div className="bg-mist border border-smoke rounded-xl rounded-bl-sm px-3 py-2">
                  <Loader2 size={14} className="animate-spin text-ash" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Example chips */}
          {messages.length === 0 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setCommand(ex)}
                  className="text-[10px] border border-smoke rounded-full px-2.5 py-1 text-charcoal hover:bg-mist transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="px-4 pb-4 pt-2 shrink-0 border-t border-smoke">
            <div className="flex gap-2">
              <textarea
                ref={textareaRef}
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder="輸入指令或問題…"
                className="flex-1 border border-smoke rounded-sm bg-mist px-3 py-2 text-sm text-ink placeholder-ash resize-none focus:outline-none focus:ring-1 focus:ring-ink"
              />
              <button
                onClick={handleSend}
                disabled={!command.trim() || isLoading}
                className="px-3 bg-ink text-paper rounded-sm flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-charcoal transition-colors"
              >
                <Send size={14} />
              </button>
            </div>
            <p className="text-center text-[10px] text-ash mt-1">⌘↵ 發送</p>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        id="tour-ai-fab"
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-20 right-4 z-50 w-12 h-12 rounded-full shadow-lifted flex items-center justify-center transition-all duration-200 ${
          open ? 'bg-charcoal rotate-45' : 'bg-ink hover:bg-charcoal active:scale-95'
        }`}
        aria-label="AI 助理"
      >
        {open ? <X size={18} className="text-paper" /> : <Sparkles size={18} className="text-paper" />}
      </button>
    </>
  );
}

// ── Confirmation Card ─────────────────────────────────────────────────────────

interface ConfirmCardProps {
  pending: PreparedTx;
  onConfirm: (extra: { buyerName?: string; soldPrice?: string; destination?: string }) => Promise<void>;
  onCancel: () => void;
}

function ConfirmCard({ pending, onConfirm, onCancel }: ConfirmCardProps) {
  const [buyerName, setBuyerName]   = useState('');
  const [soldPrice, setSoldPrice]   = useState('');
  const [destination, setDestination] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  const isCheckIn  = pending.action === 'check-in';
  const isSold     = pending.outSubtype === 'sold';
  const isTransfer = pending.outSubtype === 'transfer';

  const canConfirm =
    !isConfirming &&
    (!isSold     || buyerName.trim().length > 0) &&
    (!isTransfer || destination.trim().length > 0);

  const actionLabel = isCheckIn ? '入庫' : isSold ? '售出' : isTransfer ? '移轉' : '出庫';
  const accentCls   = isCheckIn ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50';

  async function submit() {
    if (!canConfirm) return;
    setIsConfirming(true);
    await onConfirm({
      buyerName:   buyerName.trim()   || undefined,
      soldPrice:   soldPrice.trim()   || undefined,
      destination: destination.trim() || undefined,
    });
  }

  return (
    <div className="w-full max-w-[88%] rounded-xl border border-smoke bg-paper rounded-bl-sm overflow-hidden shadow-sm">

      {/* Artwork info header */}
      <div className="px-3 pt-2.5 pb-2 bg-mist/50 border-b border-smoke/70">
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${accentCls}`}>
            {actionLabel} × {pending.qty}
          </span>
          {pending.category && (
            <span className="text-[10px] text-ash">{pending.category}</span>
          )}
        </div>
        <p className="text-sm font-semibold text-ink leading-snug">{pending.title}</p>
        <p className="text-[11px] text-ash">{pending.artist}</p>
        {!isCheckIn && (
          <p className="text-[10px] text-ash mt-0.5">
            目前庫存：<span className={pending.currentQty <= 0 ? 'text-red-500 font-medium' : 'text-ink'}>
              {pending.currentQty}
            </span>
          </p>
        )}
      </div>

      {/* Detail input fields */}
      <div className="px-3 py-2.5 space-y-2">
        {isCheckIn && (
          <p className="text-xs text-charcoal">確認將 {pending.qty} 件作品入庫？</p>
        )}
        {isSold && (
          <>
            <input
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="買家姓名 *"
              autoFocus
              className={miniInp}
            />
            <input
              type="number"
              min={0}
              value={soldPrice}
              onChange={(e) => setSoldPrice(e.target.value)}
              placeholder="成交價格 NT$（選填）"
              className={miniInp}
            />
          </>
        )}
        {isTransfer && (
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="移轉目的地 *"
            autoFocus
            className={miniInp}
          />
        )}
      </div>

      {/* Confirm / Cancel */}
      <div className="flex border-t border-smoke/70 divide-x divide-smoke/70">
        <button
          onClick={onCancel}
          disabled={isConfirming}
          className="flex-1 py-2.5 text-xs text-ash hover:text-ink hover:bg-mist/60 transition-colors disabled:opacity-40"
        >
          取消
        </button>
        <button
          onClick={submit}
          disabled={!canConfirm}
          className="flex-1 py-2.5 text-xs font-semibold text-ink hover:bg-ink hover:text-paper transition-colors disabled:opacity-30"
        >
          {isConfirming ? '執行中…' : '確認執行'}
        </button>
      </div>
    </div>
  );
}

const miniInp =
  'w-full border border-smoke rounded-sm bg-mist/30 px-2.5 py-1.5 text-xs text-ink placeholder:text-ash/70 focus:outline-none focus:border-charcoal transition-colors';
