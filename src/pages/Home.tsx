import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Plus, BarChart2 } from 'lucide-react';
import type { Artwork, LiffUser } from '../types';
import { getGASUrl } from '../services/api';
import { useArtworks } from '../hooks/useArtworks';
import Header from '../components/Header';
import ArtworkCard from '../components/ArtworkCard';
import TransactionDrawer from '../components/TransactionDrawer';
import ArtworkFormDrawer from '../components/ArtworkFormDrawer';
import PriceDrawer from '../components/PriceDrawer';
import BulkPriceDrawer from '../components/BulkPriceDrawer';
import AiCommandFab from '../components/AiCommandFab';

interface Props {
  user: LiffUser | null;
  isMock: boolean;
}

export default function Home({ user, isMock }: Props) {
  const navigate = useNavigate();
  const { artworks, isLoading, error, refetch } = useArtworks();

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

  function handleCardClick(artwork: Artwork) {
    setSelectedArtwork(artwork);
    setDrawerOpen(true);
  }

  function handleEditClick(artwork: Artwork) {
    setEditArtwork(artwork);
    setFormOpen(true);
  }

  function handlePriceClick(artwork: Artwork) {
    setPriceArtwork(artwork);
    setPriceOpen(true);
  }

  function handleAddNew() {
    setEditArtwork(null);
    setFormOpen(true);
  }

  const inStock  = artworks.filter((a) => a.status === 'in-stock').length;
  const outCount = artworks.filter((a) => a.status === 'out').length;

  return (
    <div className="flex flex-col min-h-screen bg-paper">
      <Header user={user} isMock={isMock} title="Gallery" />

      <main className="flex-1 px-4 py-5 pb-28 scroll-smooth-ios">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: '總計',   value: artworks.length },
            { label: '在庫',   value: inStock },
            { label: '已出庫', value: outCount },
          ].map(({ label, value }) => (
            <div key={label} className="border border-smoke rounded-sm p-3 text-center">
              <p className="text-xl font-semibold tabular-nums text-ink">{value}</p>
              <p className="text-[10px] text-ash uppercase tracking-widest mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Section header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-base font-semibold text-ink">Collection</h2>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setBulkOpen(true)}
              className="p-1.5 text-ash hover:text-ink transition-colors"
              aria-label="Bulk price adjustment"
            >
              <BarChart2 size={14} />
            </button>
            <button
              onClick={handleAddNew}
              className="p-1.5 text-ash hover:text-ink transition-colors"
              aria-label="Add artwork"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={refetch}
              disabled={isLoading}
              className="p-1.5 text-ash hover:text-ink transition-colors disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && error !== 'GAS_URL_NOT_SET' && (
          <div className="mb-4 border border-smoke rounded-sm px-4 py-3">
            <p className="text-sm text-charcoal font-medium">無法載入作品</p>
            <p className="text-xs text-ash mt-0.5">{error}</p>
            <button onClick={refetch} className="text-xs text-ink underline mt-1">重試</button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && artworks.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border border-smoke rounded-sm overflow-hidden animate-pulse">
                <div className="aspect-square bg-mist" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-mist rounded w-3/4" />
                  <div className="h-2.5 bg-mist rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && artworks.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="font-display text-2xl text-smoke mb-2">—</p>
            <p className="text-sm text-ash">尚無作品。</p>
            <button onClick={handleAddNew} className="mt-3 text-xs text-ink underline">
              新增第一件作品
            </button>
          </div>
        )}

        {/* Grid */}
        {artworks.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {artworks.map((artwork) => (
              <ArtworkCard
                key={artwork.id}
                artwork={artwork}
                onClick={handleCardClick}
                onEditClick={handleEditClick}
                onPriceClick={handlePriceClick}
              />
            ))}
          </div>
        )}
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

      <AiCommandFab user={user} onSuccess={refetch} />
    </div>
  );
}
