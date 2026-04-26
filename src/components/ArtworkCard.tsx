import { DollarSign, PencilLine } from 'lucide-react';
import type { Artwork } from '../types';
import StatusBadge from './StatusBadge';

interface Props {
  artwork: Artwork;
  onClick?: (artwork: Artwork) => void;
  onEditClick?: (artwork: Artwork) => void;
  onPriceClick?: (artwork: Artwork) => void;
}

export default function ArtworkCard({ artwork, onClick, onEditClick, onPriceClick }: Props) {
  const hasPrice = Number(artwork.price) > 0;

  return (
    <div className="w-full h-full flex flex-col bg-paper border border-smoke rounded-sm shadow-card overflow-hidden hover:-translate-y-1 hover:shadow-md transition-all duration-300">
      {/* Main clickable area → transaction drawer */}
      <button
        onClick={() => onClick?.(artwork)}
        className="flex-1 w-full text-left hover:shadow-lifted active:scale-[0.98] transition-all duration-150"
        aria-label={`${artwork.title} by ${artwork.artist}`}
      >
        <div className="aspect-square bg-mist relative overflow-hidden">
          {artwork.imageUrl && artwork.imageUrl.startsWith('http') ? (
            <img src={artwork.imageUrl} alt={artwork.title}
              className="w-full h-full object-cover" loading="lazy" />
          ) : (
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
          {/* Multi-state stock breakdown */}
          <div className="flex items-center gap-2.5 pt-1.5 mt-1.5 border-t border-smoke flex-wrap">
            {artwork.qty > 0 && (
              <span className="text-[10px] tabular-nums text-ink font-semibold">
                在庫 <span className="font-bold">{artwork.qty}</span>
              </span>
            )}
            {(artwork.outCount ?? 0) > 0 && (
              <span className="text-[10px] tabular-nums text-charcoal">
                出庫 {artwork.outCount}
              </span>
            )}
            {(artwork.soldCount ?? 0) > 0 && (
              <span className="text-[10px] tabular-nums text-ash">
                售出 {artwork.soldCount}
              </span>
            )}
            {artwork.qty === 0 && (artwork.outCount ?? 0) === 0 && (artwork.soldCount ?? 0) === 0 && (
              <span className="text-[10px] text-ash">—</span>
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
