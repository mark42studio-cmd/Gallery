export type ArtworkCategory = '油畫' | '雕塑' | '多媒材' | '版畫' | '膠彩';

export const ARTWORK_CATEGORIES: ArtworkCategory[] = ['油畫', '雕塑', '多媒材', '版畫', '膠彩'];

export interface Artwork {
  id: string;
  title: string;
  artist: string;
  category?: ArtworkCategory | '';
  status: 'in-stock' | 'out';
  qty: number;
  edition_total?: number | '';
  ap_count?: number | '';
  price?: number | '';
  imageUrl?: string;
  location?: string;
  notes?: string;
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

export interface AiCommandResult {
  message: string;
  artworksUpdated?: Artwork[];
}
