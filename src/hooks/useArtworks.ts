import { useState, useEffect, useCallback } from 'react';
import type { Artwork } from '../types';
import { api, getGASUrl } from '../services/api';

interface UseArtworksReturn {
  artworks: Artwork[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useArtworks(): UseArtworksReturn {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!getGASUrl()) {
      setError('GAS_URL_NOT_SET');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getArtworks();
      if (res.success && res.data) {
        setArtworks(res.data);
      } else {
        throw new Error(res.error ?? 'Failed to load artworks');
      }
    } catch (err) {
      console.error('[useArtworks] Failed to load artworks:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { artworks, isLoading, error, refetch };
}
