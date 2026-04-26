import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ExternalLink, Trash2 } from 'lucide-react';
import type { LiffUser } from '../types';
import { getGASUrl, setGASUrl, clearGASUrl } from '../services/api';
import Header from '../components/Header';

interface Props {
  user: LiffUser | null;
  isMock: boolean;
}

export default function Settings({ user, isMock }: Props) {
  const navigate = useNavigate();
  const [urlInput, setUrlInput] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const existing = getGASUrl();
    if (existing) setUrlInput(existing);
  }, []);

  function handleSave() {
    const trimmed = urlInput.trim();
    if (!trimmed) { setError('請輸入網址。'); return; }
    if (!trimmed.startsWith('https://script.google.com/')) {
      setError('網址必須以 https://script.google.com/ 開頭');
      return;
    }
    setGASUrl(trimmed);
    setError('');
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      navigate('/', { replace: true });
    }, 1500);
  }

  function handleClear() {
    clearGASUrl();
    setUrlInput('');
  }

  const isConfigured = Boolean(getGASUrl());

  return (
    <div className="flex flex-col min-h-screen bg-paper">
      <Header user={user} isMock={isMock} title="系統設定" />

      <main className="flex-1 px-4 py-6 pb-24 md:pb-8 space-y-8">
        {/* Status banner */}
        {!isConfigured && (
          <div className="border border-smoke rounded-sm p-4 bg-mist">
            <p className="text-sm font-medium text-ink mb-1">尚未設定</p>
            <p className="text-xs text-charcoal leading-relaxed">
              請在下方貼上 GAS Web App 網址以連接 Google Sheets 資料庫。
            </p>
          </div>
        )}

        {isConfigured && (
          <div className="flex items-center gap-2 text-ink bg-mist border border-smoke rounded-sm px-4 py-3">
            <CheckCircle size={14} className="shrink-0" />
            <span className="text-xs font-medium">資料庫已連線</span>
          </div>
        )}

        {/* GAS URL input */}
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">GAS Web App 網址</h2>
            <p className="text-xs text-ash mt-0.5">您的 Google Apps Script 部署網址。</p>
          </div>

          <input
            value={urlInput}
            onChange={(e) => { setUrlInput(e.target.value); setError(''); }}
            placeholder="https://script.google.com/macros/s/…/exec"
            className="w-full border border-smoke rounded-sm bg-paper px-3 py-2.5 text-sm text-ink placeholder-ash focus:outline-none focus:ring-1 focus:ring-ink font-mono"
          />

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className={`flex-1 py-2.5 rounded-sm text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                saved
                  ? 'bg-ink/10 text-ink'
                  : 'bg-ink text-paper hover:bg-charcoal active:scale-[0.98]'
              }`}
            >
              {saved ? (
                <>
                  <CheckCircle size={14} />
                  已儲存！
                </>
              ) : (
                '儲存網址'
              )}
            </button>
            {isConfigured && (
              <button
                onClick={handleClear}
                className="px-3 py-2.5 border border-smoke rounded-sm text-ash hover:text-ink hover:border-charcoal transition-colors"
                aria-label="Clear URL"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </section>

        {/* Setup guide */}
        <section className="space-y-3">
          <h2 className="font-display text-base font-semibold text-ink">設定說明</h2>
          <ol className="space-y-3">
            {[
              {
                step: '1',
                title: '建立 Google 試算表',
                desc: '新增「Artworks」和「Transactions」工作表，並依照需求設定欄位。',
              },
              {
                step: '2',
                title: '貼上 GAS 腳本',
                desc: '開啟「擴充功能 → Apps Script」，貼上本專案的 Code.gs 腳本。',
              },
              {
                step: '3',
                title: '部署為 Web App',
                desc: '「部署 → 新增部署」，將存取權限設為「所有人」，並複製網址。',
              },
              {
                step: '4',
                title: '貼上網址',
                desc: '回到此頁，貼上網址，點擊「儲存網址」。',
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-3">
                <span className="w-6 h-6 rounded-full border border-smoke flex items-center justify-center text-[11px] font-semibold text-charcoal shrink-0 mt-0.5">
                  {step}
                </span>
                <div>
                  <p className="text-sm font-medium text-ink">{title}</p>
                  <p className="text-xs text-ash leading-relaxed mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </ol>
        </section>

        {/* Artworks sheet columns */}
        <section className="space-y-2">
          <h2 className="font-display text-sm font-semibold text-ink">Artworks 工作表欄位</h2>
          <div className="border border-smoke rounded-sm overflow-hidden">
            <div className="grid grid-cols-2 bg-mist px-3 py-2 text-[10px] uppercase tracking-widest text-ash font-medium border-b border-smoke">
              <span>欄位</span>
              <span>範例</span>
            </div>
            {[
              ['id', 'artwork-001'],
              ['title', 'Starry Night'],
              ['artist', 'Van Gogh'],
              ['status', 'in-stock'],
              ['qty', '3'],
              ['imageUrl', 'https://…'],
              ['location', 'Room A'],
              ['notes', 'Fragile'],
            ].map(([col, ex]) => (
              <div key={col} className="grid grid-cols-2 px-3 py-2 text-xs border-b border-smoke last:border-0">
                <span className="font-mono text-ink">{col}</span>
                <span className="text-ash">{ex}</span>
              </div>
            ))}
          </div>
        </section>

        {/* App info */}
        <section className="space-y-1 pt-2 border-t border-smoke">
          <button className="w-full flex items-center justify-between py-3 text-sm text-charcoal hover:text-ink transition-colors">
            <span>View on GitHub</span>
            <div className="flex items-center gap-1 text-ash">
              <ExternalLink size={12} />
            </div>
          </button>
          <div className="flex items-center justify-between py-3 text-sm text-ash">
            <span>版本</span>
            <span className="font-mono text-xs">1.0.0</span>
          </div>
          {isMock && (
            <div className="flex items-center justify-between py-3 text-sm text-ash">
              <span>模式</span>
              <span className="text-xs border border-smoke rounded-full px-2 py-0.5">Dev / Mock LIFF</span>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
