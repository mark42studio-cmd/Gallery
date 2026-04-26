import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ExternalLink, Trash2, Wifi, WifiOff, Loader2 } from 'lucide-react';
import type { LiffUser } from '../types';
import { getGASUrl, setGASUrl, clearGASUrl } from '../services/api';
import Header from '../components/Header';

interface Props {
  user: LiffUser | null;
  isMock: boolean;
}

type TestStatus = 'idle' | 'testing' | 'ok' | 'fail';

const ARTWORKS_SCHEMA: [string, string, string][] = [
  ['id',            'art-001',       '系統自動產生'],
  ['title',         '無題',           '作品名稱'],
  ['artist',        '張大千',          '藝術家'],
  ['category',      '版畫',           '油畫／雕塑／版畫…'],
  ['status',        'in-stock',      '系統自動更新'],
  ['qty',           '3',             '系統自動同步'],
  ['edition_total', '50',            '版畫限定版次數'],
  ['ap_count',      '5',             '版畫 AP 數量'],
  ['price',         '120000',        '售價 NT$'],
  ['location',      '自家',           '存放地點'],
  ['imageUrl',      'https://…',      'Google Drive 縮圖'],
  ['notes',         '易碎，請輕放',    '備注'],
  ['qty_home',      '（Auto）',       '由 Editions 計算'],
  ['qty_out',       '（Auto）',       '由 Editions 計算'],
  ['qty_sold',      '（Auto）',       '由 Editions 計算'],
];

const EDITIONS_SCHEMA: [string, string, string][] = [
  ['artworkId',         'art-001',    '對應 Artworks.id'],
  ['edition_number',    '12',          '版次號；AP 填 AP1'],
  ['location_category', '家裡',         '家裡 ／ 畫廊 ／ 已售出'],
  ['location_detail',   '誠品松菸',     '選填，畫廊名稱'],
  ['is_sold',           'FALSE',       'TRUE ＝ 已售出'],
  ['sold_price',        '95000',       '成交價 NT$'],
  ['is_framed',         'TRUE',        '是否裝框'],
  ['notes',             '保存良好',    '備注'],
];

export default function Settings({ user, isMock }: Props) {
  const navigate = useNavigate();
  const [urlInput, setUrlInput]   = useState('');
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState('');
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMsg, setTestMsg]     = useState('');

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
    setTestStatus('idle');
    setTimeout(() => {
      setSaved(false);
      navigate('/', { replace: true });
    }, 1500);
  }

  function handleClear() {
    clearGASUrl();
    setUrlInput('');
    setTestStatus('idle');
    setTestMsg('');
  }

  async function handleTest() {
    const url = urlInput.trim();
    if (!url) { setError('請先輸入網址。'); return; }
    setError('');
    setTestStatus('testing');
    setTestMsg('');
    try {
      const res = await fetch(`${url}?action=getArtworks`, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { success: boolean; data?: unknown[]; error?: string };
      if (json.success) {
        setTestStatus('ok');
        setTestMsg(`連線正常 · 共 ${Array.isArray(json.data) ? json.data.length : 0} 件作品`);
      } else {
        setTestStatus('fail');
        setTestMsg(json.error ?? '端點回應異常');
      }
    } catch (err) {
      setTestStatus('fail');
      setTestMsg(err instanceof Error ? err.message : '無法連線，請檢查網址');
    }
  }

  const isConfigured = Boolean(getGASUrl());

  return (
    <div className="flex flex-col min-h-screen bg-paper">
      <Header user={user} isMock={isMock} title="系統設定" />

      <main className="flex-1 px-4 py-6 pb-24 md:pb-8 space-y-8">

        {/* ── Connection status banner ── */}
        {!isConfigured && testStatus === 'idle' && (
          <div className="border border-smoke rounded-sm p-4 bg-mist">
            <p className="text-sm font-medium text-ink mb-1">尚未設定連線</p>
            <p className="text-xs text-charcoal leading-relaxed">
              請在下方貼上 GAS Web App 網址以連接 Google Sheets 資料庫。
            </p>
          </div>
        )}

        {isConfigured && testStatus === 'idle' && (
          <div className="flex items-center gap-2 text-ink bg-mist border border-smoke rounded-sm px-4 py-3">
            <CheckCircle size={14} className="shrink-0" />
            <span className="text-xs font-medium">網址已設定 — 點擊「測試連線」確認狀態</span>
          </div>
        )}

        {testStatus === 'ok' && (
          <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-sm px-4 py-3">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-700">{testMsg}</span>
          </div>
        )}

        {testStatus === 'fail' && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-sm px-4 py-3">
            <WifiOff size={14} className="text-red-500 shrink-0" />
            <span className="text-xs text-red-600">{testMsg}</span>
          </div>
        )}

        {/* ── GAS URL input ── */}
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">GAS Web App 網址</h2>
            <p className="text-xs text-ash mt-0.5">您的 Google Apps Script 部署網址。</p>
          </div>

          <input
            value={urlInput}
            onChange={(e) => { setUrlInput(e.target.value); setError(''); setTestStatus('idle'); }}
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
              {saved ? <><CheckCircle size={14} />已儲存！</> : '儲存網址'}
            </button>

            <button
              onClick={handleTest}
              disabled={testStatus === 'testing'}
              className="px-3 py-2.5 border border-smoke rounded-sm text-ash hover:text-ink hover:border-charcoal transition-colors disabled:opacity-40 flex items-center gap-1.5 text-xs font-medium whitespace-nowrap"
            >
              {testStatus === 'testing'
                ? <><Loader2 size={13} className="animate-spin" />測試中…</>
                : <><Wifi size={13} />測試連線</>
              }
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

        {/* ── Setup guide ── */}
        <section className="space-y-3">
          <h2 className="font-display text-base font-semibold text-ink">設定說明</h2>
          <ol className="space-y-3">
            {[
              { step: '1', title: '建立 Google 試算表', desc: '新增「Artworks」和「Editions」工作表，依照下方欄位規格建立標題列。' },
              { step: '2', title: '貼上 GAS 腳本', desc: '開啟「擴充功能 → Apps Script」，貼上本專案的 Code.gs 腳本。' },
              { step: '3', title: '部署為 Web App', desc: '「部署 → 新增部署」，執行身份設為「我」，存取權限設為「所有人」，複製網址。' },
              { step: '4', title: '貼上並測試', desc: '回到此頁貼上網址，點擊「測試連線」確認正常後儲存。' },
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

        {/* ── Artworks schema ── */}
        <section className="space-y-2">
          <h2 className="font-display text-sm font-semibold text-ink">Artworks 工作表欄位</h2>
          <p className="text-[10px] text-ash leading-relaxed">
            標示「Auto」的欄位由系統從 Editions 自動計算，試算表中<strong className="font-medium text-charcoal">不需要</strong>建立這些欄。
          </p>
          <div className="border border-smoke rounded-sm overflow-hidden">
            <div className="grid grid-cols-3 bg-mist px-3 py-2 text-[10px] uppercase tracking-widest text-ash font-medium border-b border-smoke">
              <span>欄位</span><span>範例值</span><span>備注</span>
            </div>
            {ARTWORKS_SCHEMA.map(([col, ex, note]) => (
              <div
                key={col}
                className={`grid grid-cols-3 px-3 py-2 text-xs border-b border-smoke last:border-0 ${
                  col.startsWith('qty_') ? 'bg-mist/50' : ''
                }`}
              >
                <span className={`font-mono ${col.startsWith('qty_') ? 'text-ash' : 'text-ink'}`}>{col}</span>
                <span className="text-ash">{ex}</span>
                <span className="text-[10px] text-ash/70">{note}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Editions schema ── */}
        <section className="space-y-2">
          <h2 className="font-display text-sm font-semibold text-ink">Editions 工作表欄位</h2>
          <p className="text-[10px] text-ash leading-relaxed">
            版畫作品每一版次各佔一列；非版畫作品無需建立此工作表。
          </p>
          <div className="border border-smoke rounded-sm overflow-hidden">
            <div className="grid grid-cols-3 bg-mist px-3 py-2 text-[10px] uppercase tracking-widest text-ash font-medium border-b border-smoke">
              <span>欄位</span><span>範例值</span><span>備注</span>
            </div>
            {EDITIONS_SCHEMA.map(([col, ex, note]) => (
              <div key={col} className="grid grid-cols-3 px-3 py-2 text-xs border-b border-smoke last:border-0">
                <span className="font-mono text-ink">{col}</span>
                <span className="text-ash">{ex}</span>
                <span className="text-[10px] text-ash/70">{note}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── App info ── */}
        <section className="space-y-1 pt-2 border-t border-smoke">
          <button className="w-full flex items-center justify-between py-3 text-sm text-charcoal hover:text-ink transition-colors">
            <span>View on GitHub</span>
            <ExternalLink size={12} className="text-ash" />
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

        {/* ── Branding footer ── */}
        <div className="pt-2 pb-4 text-center">
          <p className="text-[10px] text-ash/40 leading-loose tracking-wide">
            © 2026 Gallery Management System
            <br />
            Designed by 一圈工作室 &middot; v1.0.0
          </p>
        </div>

      </main>
    </div>
  );
}
