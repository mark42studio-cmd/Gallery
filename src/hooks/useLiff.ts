import { useState, useEffect } from 'react';
import liff from '@line/liff';
import type { LiffUser } from '../types';

const MOCK_USER: LiffUser = {
  userId: 'mock-user-001',
  displayName: 'Gallery Manager',
  pictureUrl: undefined,
};

const LIFF_ID = import.meta.env.VITE_LIFF_ID as string | undefined;

interface UseLiffReturn {
  user: LiffUser | null;
  isLoading: boolean;
  isMock: boolean;
  error: string | null;
}

export function useLiff(): UseLiffReturn {
  const [user, setUser] = useState<LiffUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMock, setIsMock] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!LIFF_ID || LIFF_ID === 'your-liff-id-here') {
        if (!cancelled) { setUser(MOCK_USER); setIsMock(true); setIsLoading(false); }
        return;
      }

      try {
        await liff.init({ liffId: LIFF_ID });

        if (!liff.isInClient() && !liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const profile = await liff.getProfile();
        if (!cancelled) {
          setUser({
            userId: profile.userId,
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl ?? undefined,
          });
          setIsMock(!liff.isInClient());
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'LIFF init failed');
          setUser(MOCK_USER);
          setIsMock(true);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  return { user, isLoading, isMock, error };
}
