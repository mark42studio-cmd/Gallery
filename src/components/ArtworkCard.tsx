import { DollarSign, PencilLine } from 'lucide-react';
import type { Artwork } from '../types';
import StatusBadge from './StatusBadge';

type StatFilter = 'all' | 'in-stock' | 'out' | 'sold';

interface Props {
  artwork: Artwork;
  onClick?: (artwork: Artwork) => void;
  onEditClick?: (artwork: Artwork) => void;
  onPriceClick?: (artwork: Artwork) => void;
  activeFilter?: StatFilter;
}

function StatHeroBadge({ label, count, variant }: {
  label: string;
  count: number;
  variant: 'stock' | 'out' | 'sold';
}) {
  const base = 'inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-sm tabular-nums';
  const cls =
    variant === 'stock' ? 'bg-ink text-paper' :
    variant === 'out'   ? 'border-2 border-charcoal text-charcoal' :
                          'bg-charcoal text-paper/80';
  return <span className={`${base} ${cls}`}>{label} {count}</span>;
}

export default function ArtworkCard({ artwork, onClick, onEditClick, onPriceClick, activeFilter = 'all' }: Props) {
  const hasPrice   = Number(artwork.price) > 0;
  const validImage = Boolean(artwork.imageUrl) &&
    typeof artwork.imageUrl === 'string' &&
    artwork.imageUrl.startsWith('http');

  const qtyHome = Number(artwork.qty_home ?? artwork.qty)       || 0;
  const qtyOut  = Number(artwork.qty_out  ?? artwork.outCount)  || 0;
  const qtySold = Number(artwork.qty_sold ?? artwork.soldCount) || 0;

  return (
    <div className="w-full h-full flex flex-col bg-paper border border-smoke rounded-sm shadow-card overflow-hidden hover:-translate-y-1 hover:shadow-md transition-all duration-300">
      {/* Main clickable area → transaction drawer */}
      <button
        onClick={() => onClick?.(artwork)}
        className="flex-1 w-full text-left hover:shadow-lifted active:scale-[0.98] transition-all duration-150"
        aria-label={`${artwork.title} by ${artwork.artist}`}
      >
        <div className="aspect-square bg-mist relative overflow-hidden">
          {validImage ? (
            <img
              src={artwork.imageUrl as string}
              alt={artwork.title}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : null}
          {!validImage && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-display text-4xl text-smoke select-none">
                {artwork.title.charAt(0)}
              </span>
            </div>
          )}
          <div className="absolute top-2 left-2">
            <StatusBadge status={artwork.status} />
          </div>
          {artwork.category && (
            <div className="absolute top-2 right-2 bg-black/60 text-paper text-[9px] px-1.5 py-0.5 rounded-full leading-none">
              {artwork.category}
            </div>
          )}
        </div>

        <div className="p-3 space-y-0.5">
          <p className="font-display text-sm font-semibold leading-snug text-ink line-clamp-2">
            {artwork.title}
          </p>
          <p className="text-xs text-charcoal font-light">{artwork.artist}</p>
          {/* Context-aware stat badge */}
          <div className="pt-1.5 mt-1.5 border-t border-smoke">
            {activeFilter === 'in-stock' ? (
              <StatHeroBadge label="在庫" count={qtyHome} variant="stock" />
            ) : activeFilter === 'out' ? (
              <StatHeroBadge label="出庫" count={qtyOut} variant="out" />
            ) : activeFilter === 'sold' ? (
              <StatHeroBadge label="售出" count={qtySold} variant="sold" />
            ) : (
              <div className="flex items-center gap-2.5 flex-wrap">
                {qtyHome > 0 && (
                  <span className="text-[10px] tabular-nums text-ink font-semibold">
                    在庫 <span className="font-bold">{qtyHome}</span>
                  </span>
                )}
                {qtyOut > 0 && (
                  <span className="text-[10px] tabular-nums text-charcoal">出庫 {qtyOut}</span>
                )}
                {qtySold > 0 && (
                  <span className="text-[10px] tabular-nums text-ash">售出 {qtySold}</span>
                )}
                {qtyHome === 0 && qtyOut === 0 && qtySold === 0 && (
                  <span className="text-[10px] text-ash">—</span>
                )}
              </div>
            )}
          </div>
          {hasPrice && (
            <p className="text-[10px] text-charcoal font-medium tabular-nums">
              NT$ {Number(artwork.price).toLocaleString()}
            </p>
          )}
          {artwork.category === '版畫' && (Number(artwork.edition_total) > 0 || Number(artwork.ap_count) > 0) && (
            <p className="text-[10px] text-ash font-mono">
              {[
                Number(artwork.edition_total) > 0 ? `ED: ${artwork.edition_total}` : null,
                Number(artwork.ap_count) > 0 ? `AP: ${artwork.ap_count}` : null,
              ].filter(Boolean).join(' / ')}
            </p>
          )}
          {artwork.location && (
            <p className="text-[10px] text-ash truncate">{artwork.location}</p>
          )}
        </div>
      </button>

      {/* Action bar — price & edit buttons */}
      {(onPriceClick || onEditClick) && (
        <div className="flex border-t border-smoke divide-x divide-smoke">
          {onPriceClick && (
            <button
              onClick={() => onPriceClick(artwork)}
              className="flex-1 flex items-center justify-center gap-1 py-2 text-ash hover:text-ink hover:bg-mist transition-colors text-[10px] uppercase tracking-widest"
              aria-label="Price management"
            >
              <DollarSign size={11} />
              定價
            </button>
          )}
          {onEditClick && (
            <button
              onClick={() => onEditClick(artwork)}
              className="flex-1 flex items-center justify-center gap-1 py-2 text-ash hover:text-ink hover:bg-mist transition-colors text-[10px] uppercase tracking-widest"
              aria-label="Edit artwork"
            >
              <PencilLine size={11} />
              編輯
            </button>
          )}
        </div>
      )}
    </div>
  );
}
