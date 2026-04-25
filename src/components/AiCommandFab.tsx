import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';
import type { LiffUser } from '../types';
import { api } from '../services/api';

interface Props {
  user: LiffUser | null;
  onSuccess: () => void;
}

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  ok?: boolean;
}

export default function AiCommandFab({ user, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [command, setCommand] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    } else {
      setCommand('');
      setMessages([]);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  async function handleSend() {
    if (!command.trim() || !user || isLoading) return;
    const userText = command.trim();
    setCommand('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);
    try {
      const res = await api.aiCommand(userText, user.userId, user.displayName);
      if (res.success && res.data) {
        setMessages(prev => [...prev, { role: 'ai', text: res.data?.message ?? 'Done.', ok: true }]);
        onSuccess();
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: res.error ?? 'Command failed.', ok: false }]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'ai', text: err instanceof Error ? err.message : 'Network error.', ok: false },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend();
  }

  const EXAMPLES = [
    '庫存裡有草間彌生的作品嗎？',
    '剛賣出 2 件蒙娜麗莎',
    '入庫 5 件星夜',
  ];

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
          <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-2 min-h-0">
            {messages.length === 0 && (
              <p className="text-xs text-ash py-1">
                用自然語言描述庫存操作，或詢問作品資訊。
              </p>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex items-end gap-1.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'ai' && (
                  <div className="w-5 h-5 rounded-full bg-ink flex items-center justify-center shrink-0 mb-0.5">
                    <Sparkles size={10} className="text-paper" />
                  </div>
                )}
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

          {/* Example chips — only when no messages yet */}
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
