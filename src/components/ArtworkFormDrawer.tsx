import { useState, useEffect } from 'react';
import { Drawer } from 'vaul';
import { X } from 'lucide-react';
import type { Artwork, LiffUser, ArtworkCategory } from '../types';
import { ARTWORK_CATEGORIES } from '../types';
import { api } from '../services/api';

interface Props {
  open: boolean;
  onClose: () => void;
  artwork?: Artwork | null;
  user: LiffUser | null;
  onSuccess: () => void;
}

const BLANK = {
  title: '', artist: '', category: '' as ArtworkCategory | '',
  qty: 1, edition_total: '', ap_count: '', price: '', price_frame: '',
  imageUrl: '', location: '', notes: '',
  creation_year: '', paper_size: '', image_size: '',
};

export default function ArtworkFormDrawer({ open, onClose, artwork, user: _user, onSuccess }: Props) {
  const isEdit = !!artwork;
  const [form, setForm] = useState(BLANK);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setFeedback(null);
    if (artwork) {
      setForm({
        title: artwork.title,
        artist: artwork.artist,
        category: artwork.category || '',
        qty: artwork.qty,
        edition_total: artwork.edition_total != null && artwork.edition_total !== '' ? String(artwork.edition_total) : '',
        ap_count: artwork.ap_count != null && artwork.ap_count !== '' ? String(artwork.ap_count) : '',
        price: artwork.price != null && artwork.price !== '' ? String(artwork.price) : '',
        price_frame: artwork.price_frame != null ? String(artwork.price_frame) : '',
        imageUrl: artwork.imageUrl || '',
        location: artwork.location || '',
        notes: artwork.notes || '',
        creation_year: artwork.creation_year != null ? String(artwork.creation_year) : '',
        paper_size: artwork.paper_size || '',
        image_size: artwork.image_size || '',
      });
    } else {
      setForm(BLANK);
    }
  }, [open, artwork]);

  const isPrintmaking = form.category === '版畫';

  async function handleSubmit() {
    if (!form.title.trim() || !form.artist.trim()) {
      setFeedback({ ok: false, msg: '作品名稱和藝術家為必填。' });
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const editionTotal = isPrintmaking && form.edition_total ? Number(form.edition_total) : undefined;
      const payload = {
        ...form,
        qty: Number(form.qty) || 0,
        edition_total: editionTotal,
        total_editions: editionTotal,
        ap_count: isPrintmaking && form.ap_count ? Number(form.ap_count) : undefined,
        price: form.price ? Number(form.price) : undefined,
        price_unframed: form.price ? Number(form.price) : undefined,
        price_frame: form.price_frame ? Number(form.price_frame) : undefined,
        creation_year: form.creation_year ? Number(form.creation_year) : undefined,
        paper_size: isPrintmaking && form.paper_size ? form.paper_size : undefined,
        image_size: isPrintmaking && form.image_size ? form.image_size : undefined,
      };
      const res = isEdit && artwork
        ? await api.updateArtwork({ ...artwork, ...payload } as Artwork)
        : await api.createArtwork(payload);

      if (!res.success) throw new Error(res.error);
      setFeedback({ ok: true, msg: isEdit ? '作品已更新。' : '作品已新增。' });
      setTimeout(() => { onSuccess(); onClose(); }, 900);
    } catch (err) {
      setFeedback({ ok: false, msg: err instanceof Error ? err.message : '操作失敗' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Drawer.Root open={open} onOpenChange={(v) => !v && onClose()} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm" />
        <Drawer.Content className="fixed bottom-0 inset-x-0 z-50 flex flex-col rounded-t-2xl bg-paper shadow-drawer focus:outline-none max-h-[92vh]">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-smoke" />
          </div>

          <div className="px-5 pb-2 flex items-center justify-between shrink-0">
            <Drawer.Title className="font-display text-lg font-semibold text-ink">
              {isEdit ? '編輯作品' : '新增作品'}
            </Drawer.Title>
            <button onClick={onClose} className="p-1 text-ash hover:text-ink transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-4 no-scrollbar">
            <Field label="作品名稱 *">
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. 春日" className={inp} />
            </Field>

            <Field label="藝術家 *">
              <input value={form.artist} onChange={e => setForm(f => ({ ...f, artist: e.target.value }))}
                placeholder="e.g. 王小明" className={inp} />
            </Field>

            <Field label="類別">
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as ArtworkCategory | '', edition_total: '', ap_count: '' }))}
                className={inp}
              >
                <option value="">— 選擇類別 —</option>
                {ARTWORK_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </Field>

            {isPrintmaking && (
              <div className="grid grid-cols-2 gap-3 p-3 border border-smoke rounded-sm bg-mist">
                <Field label="總號數 (Edition Total)">
                  <input type="number" min={0} value={form.edition_total}
                    onChange={e => setForm(f => ({ ...f, edition_total: e.target.value }))}
                    placeholder="e.g. 50" className={inp} />
                </Field>
                <Field label="AP 數量">
                  <input type="number" min={0} value={form.ap_count}
                    onChange={e => setForm(f => ({ ...f, ap_count: e.target.value }))}
                    placeholder="e.g. 5" className={inp} />
                </Field>
                <Field label="紙張尺寸">
                  <input value={form.paper_size}
                    onChange={e => setForm(f => ({ ...f, paper_size: e.target.value }))}
                    placeholder="e.g. 38×56cm" className={inp} />
                </Field>
                <Field label="圖像尺寸">
                  <input value={form.image_size}
                    onChange={e => setForm(f => ({ ...f, image_size: e.target.value }))}
                    placeholder="e.g. 30×40cm" className={inp} />
                </Field>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="數量">
                <input type="number" min={0} value={form.qty}
                  onChange={e => setForm(f => ({ ...f, qty: Number(e.target.value) }))}
                  className={inp} />
              </Field>
              <Field label="創作年份">
                <input type="number" min={1900} max={2100} value={form.creation_year}
                  onChange={e => setForm(f => ({ ...f, creation_year: e.target.value }))}
                  placeholder="e.g. 2023" className={inp} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="定價-未裱框 (NT$)">
                <input type="number" min={0} value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="e.g. 80000" className={inp} />
              </Field>
              <Field label="裱框加價 (NT$)">
                <input type="number" min={0} value={form.price_frame}
                  onChange={e => setForm(f => ({ ...f, price_frame: e.target.value }))}
                  placeholder="e.g. 5000" className={inp} />
              </Field>
            </div>

            <Field label="存放位置">
              <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="e.g. A-03" className={inp} />
            </Field>

            <Field label="圖片網址">
              <input value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://..." className={inp} />
            </Field>

            <Field label="備註">
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} placeholder="其他說明..." className={`${inp} resize-none`} />
            </Field>
          </div>

          <div className="px-5 py-4 border-t border-smoke shrink-0 space-y-2">
            {feedback && (
              <p className={`text-sm text-center ${feedback.ok ? 'bg-ink/5 text-ink' : 'bg-red-50 text-red-600'} py-2 rounded-sm`}>
                {feedback.msg}
              </p>
            )}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-ink text-paper py-3 rounded-sm text-sm font-semibold tracking-wide disabled:opacity-40 hover:bg-charcoal active:scale-[0.98] transition-all"
            >
              {loading ? '處理中…' : isEdit ? '儲存變更' : '新增作品'}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

const inp = 'w-full px-3 py-2 border border-smoke rounded-sm bg-paper text-sm text-ink placeholder-ash focus:outline-none focus:ring-1 focus:ring-ink';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] uppercase tracking-widest text-ash font-medium">{label}</label>
      {children}
    </div>
  );
}
