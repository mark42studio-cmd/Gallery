import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, DollarSign, PencilLine, Plus } from 'lucide-react';
import type { Artwork, LiffUser } from '../types';
import { getGASUrl } from '../services/api';
import { useArtworks } from '../hooks/useArtworks';
import Header from '../components/Header';
import StatusBadge from '../components/StatusBadge';
import TransactionDrawer from '../components/TransactionDrawer';
import ArtworkFormDrawer from '../components/ArtworkFormDrawer';
import PriceDrawer from '../components/PriceDrawer';
import BulkPriceDrawer from '../components/BulkPriceDrawer';

interface Props {
  user: LiffUser | null;
  isMock: boolean;
}

type Filter = 'all' | 'in-stock' | 'out' | 'sold';

export default function Inventory({ user, isMock }: Props) {
  const navigate = useNavigate();
  const { artworks, isLoading, refetch } = useArtworks();
  const [query, setQuery]   = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);

  const [formOpen, setFormOpen]           = useState(false);
  const [editArtwork, setEditArtwork]     = useState<Artwork | null>(null);

  const [priceOpen, setPriceOpen]         = useState(false);
  const [priceArtwork, setPriceArtwork]   = useState<Artwork | null>(null);

  const [bulkOpen, setBulkOpen]           = useState(false);

  useEffect(() => {
    if (!getGASUrl()) navigate('/settings', { replace: true });
  }, [navigate]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return artworks.filter((a) => {
      const matchesQuery =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.artist.toLowerCase().includes(q) ||
        (a.location ?? '').toLowerCase().includes(q) ||
        (a.category ?? '').toLowerCase().includes(q);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'in-stock' && (Number(a.qty_home)  || 0) > 0) ||
        (filter === 'out'      && (Number(a.qty_out)   || 0) > 0) ||
        (filter === 'sold'     && (Number(a.qty_sold)  || 0) > 0);
      return matchesQuery && matchesFilter;
    });
  }, [artworks, query, filter]);

  function handleEditClick(artwork: Artwork) {
    setEditArtwork(artwork);
    setFormOpen(true);
  }

  function handlePriceClick(artwork: Artwork) {
    setPriceArtwork(artwork);
    setPriceOpen(true);
  }

  return (
    <div className="flex flex-col min-h-screen bg-paper">
      <Header user={user} isMock={isMock} title="庫存管理" />

      <div className="sticky top-14 z-20 bg-paper border-b border-smoke px-4 py-3 space-y-2.5">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ash pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋作品名稱、藝術家、位置..."
            className="w-full pl-9 pr-4 py-2 border border-smoke rounded-sm bg-mist text-sm text-ink placeholder-ash focus:outline-none focus:ring-1 focus:ring-ink"
          />
        </div>

        <div className="flex gap-2 items-center">
          <SlidersHorizontal size={12} className="text-ash shrink-0" />
          {(['all', 'in-stock', 'out', 'sold'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] uppercase tracking-widest font-medium px-2.5 py-1 rounded-full border transition-colors ${
                filter === f
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-paper text-ash border-smoke hover:border-charcoal'
              }`}
            >
              {f === 'all' ? '全部' : f === 'in-stock' ? '在庫' : f === 'out' ? '已出庫' : '已售出'}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-ash tabular-nums">{filtered.length}</span>
          <button
            onClick={() => setBulkOpen(true)}
            className="p-1 text-ash hover:text-ink transition-colors"
            aria-label="Bulk price"
          >
            <DollarSign size={13} />
          </button>
          <button
            onClick={() => { setEditArtwork(null); setFormOpen(true); }}
            className="p-1 text-ash hover:text-ink transition-colors"
            aria-label="Add artwork"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      <main className="flex-1 pb-24 md:pb-8 scroll-smooth-ios">
        {isLoading && artworks.length === 0 && (
          <div className="divide-y divide-smoke">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 bg-mist rounded-sm shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-mist rounded w-2/3" />
                  <div className="h-2.5 bg-mist rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="font-display text-2xl text-smoke">—</p>
            <p className="text-sm text-ash mt-2">找不到符合的結果。</p>
          </div>
        )}

        <div className="divide-y divide-smoke">
          {filtered.map((artwork, i) => (
            <motion.div
              key={artwork.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.6) }}
              className="flex items-center hover:bg-mist transition-colors"
            >
              {/* Main click area → transaction drawer */}
              <button
                onClick={() => { setSelectedArtwork(artwork); setDrawerOpen(true); }}
                className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3 text-left active:bg-smoke transition-colors"
              >
                <div className="w-10 h-10 rounded-sm bg-mist shrink-0 overflow-hidden">
                  {artwork.imageUrl && typeof artwork.imageUrl === 'string' && artwork.imageUrl.startsWith('http') ? (
                    <img src={artwork.imageUrl} alt={artwork.title}
                      className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="font-display text-lg text-smoke">{artwork.title.charAt(0)}</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{artwork.title}</p>
                  <p className="text-xs text-ash truncate">{artwork.artist}</p>
                  {artwork.category === '版畫' && (Number(artwork.edition_total) > 0 || Number(artwork.ap_count) > 0) && (
                    <p className="text-[10px] text-ash font-mono mt-0.5">
                      {[
                        Number(artwork.edition_total) > 0 ? `ED: ${artwork.edition_total}` : null,
                        Number(artwork.ap_count) > 0 ? `AP: ${artwork.ap_count}` : null,
                      ].filter(Boolean).join(' / ')}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {artwork.location && (
                      <p className="text-[10px] text-ash/70 truncate">{artwork.location}</p>
                    )}
                    {artwork.category && (
                      <span className="text-[9px] bg-mist border border-smoke text-ash px-1 py-0.5 rounded-full leading-none shrink-0">
                        {artwork.category}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusBadge status={artwork.status} />
                  <span className="text-xs tabular-nums font-semibold text-ink">×{artwork.qty}</span>
                  {Number(artwork.price) > 0 && (
                    <span className="text-[10px] text-ash tabular-nums">
                      NT${Number(artwork.price).toLocaleString()}
                    </span>
                  )}
                </div>
              </button>

              {/* Action icon buttons */}
              <div className="flex flex-col gap-0.5 px-2 shrink-0">
                <button
                  onClick={() => handlePriceClick(artwork)}
                  className="p-1.5 text-ash hover:text-ink transition-colors rounded-sm hover:bg-smoke"
                  aria-label="Price management"
                >
                  <DollarSign size={13} />
                </button>
                <button
                  onClick={() => handleEditClick(artwork)}
                  className="p-1.5 text-ash hover:text-ink transition-colors rounded-sm hover:bg-smoke"
                  aria-label="Edit artwork"
                >
                  <PencilLine size={13} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      <TransactionDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedArtwork(null); }}
        artworks={artworks}
        user={user}
        initialArtwork={selectedArtwork}
        onSuccess={refetch}
      />

      <ArtworkFormDrawer
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditArtwork(null); }}
        artwork={editArtwork}
        user={user}
        onSuccess={refetch}
      />

      <PriceDrawer
        open={priceOpen}
        onClose={() => { setPriceOpen(false); setPriceArtwork(null); }}
        artwork={priceArtwork}
        user={user}
        onSuccess={refetch}
      />

      <BulkPriceDrawer
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        artworks={artworks}
        user={user}
        onSuccess={refetch}
      />
    </div>
  );
}
