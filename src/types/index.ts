export type ArtworkCategory = '油畫' | '雕塑' | '多媒材' | '版畫' | '膠彩';
export const ARTWORK_CATEGORIES: ArtworkCategory[] = ['油畫', '雕塑', '多媒材', '版畫', '膠彩'];

export type LocationCategory = '家裡' | '畫廊' | '已售出';

export interface Edition {
  edition_number: number | string; // string for AP editions, e.g. "AP1"
  location_category: LocationCategory;
  location_detail?: string;
  is_sold: boolean;
  sold_price?: number;
  is_framed: boolean;
  notes?: string;
}

export interface Artwork {
  id: string;
  title: string;
  artist: string;
  category?: ArtworkCategory | '';
  // Legacy aggregate fields (kept for backward compat with existing UI)
  status: 'in-stock' | 'out' | 'sold';
  qty: number;
  edition_total?: number | '';
  ap_count?: number | '';
  price?: number | '';
  imageUrl?: string;
  location?: string;
  notes?: string;
  outCount?: number;
  soldCount?: number;
  // New edition-aware fields
  creation_year?: number;
  paper_size?: string;
  image_size?: string;
  total_editions?: number;
  price_unframed?: number;
  price_frame?: number;
  editions?: Edition[];
}

export interface Transaction {
  id: string;
  artworkId: string;
  artworkTitle: string;
  type: 'check-in' | 'check-out';
  qty: number;
  date: string;
  userId: string;
  userName: string;
  notes?: string;
}

export interface PriceHistory {
  id: string;
  artworkId: string;
  oldPrice: number | '';
  newPrice: number | '';
  date: string;
  reason: string;
  userId: string;
}

export interface LiffUser {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

export interface GASResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PreparedTx {
  artworkId: string;
  title: string;
  artist: string;
  category: string;
  currentQty: number;
  action: 'check-in' | 'check-out';
  qty: number;
  outSubtype?: 'transfer' | 'sold' | null;
  userId: string;
  userName: string;
  notes?: string;
}

export interface AiCommandResult {
  message?: string;
  intent?: string;
  prepared?: PreparedTx;
  artworksUpdated?: Artwork[];
}
