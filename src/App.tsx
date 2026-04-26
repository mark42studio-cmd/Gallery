import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useLiff } from './hooks/useLiff';
import { getGASUrl } from './services/api';
import type { LiffUser } from './types';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings';
import Onboarding, { type OnboardingStep } from './components/Onboarding';

const TOUR_STEPS: OnboardingStep[] = [
  {
    targetId: 'tour-stats',
    title: '庫存總覽',
    content: '一眼掌握作品總數、在庫與已出庫數量，隨時了解藏品動態。',
  },
  {
    targetId: 'tour-add-artwork',
    title: '新增作品',
    content: '點擊「＋」即可登錄新作品，填寫藝術家、媒材、尺寸等完整資訊。',
  },
  {
    targetId: 'tour-ai-fab',
    title: 'AI 助理',
    content: '用自然語言描述庫存操作，例如「剛售出 2 件草間彌生」，AI 會自動完成記錄。',
  },
  {
    targetId: 'tour-stats',
    title: '版次庫存自動計算',
    content: '提示：在庫、出庫、售出數量均由「Editions」工作表自動統計，無需手動修改 Artworks 的數量欄位。',
  },
];

interface SharedProps {
  user: LiffUser | null;
  isMock: boolean;
}

// Must live inside <BrowserRouter> to use useLocation.
function AppRoutes({ user, isMock }: SharedProps) {
  const location = useLocation();
  const isMainPage    = location.pathname === '/' || location.pathname === '/inventory';
  const hasConnection = Boolean(getGASUrl());

  return (
    <>
      <div className="md:pl-64 min-h-screen">
        <div className="max-w-6xl mx-auto">
          <Routes>
            <Route path="/"          element={<Home      user={user} isMock={isMock} />} />
            <Route path="/inventory" element={<Inventory user={user} isMock={isMock} />} />
            <Route path="/settings"  element={<Settings  user={user} isMock={isMock} />} />
            <Route path="*"          element={<Home      user={user} isMock={isMock} />} />
          </Routes>
        </div>
      </div>

      <BottomNav />

      {/* Tour: only on main pages and only when GAS is connected */}
      {isMainPage && hasConnection && <Onboarding steps={TOUR_STEPS} />}
    </>
  );
}

function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-paper gap-3">
      <p className="font-display text-2xl font-semibold text-ink animate-pulse">Gallery</p>
      <p className="text-xs text-ash uppercase tracking-widest">Loading…</p>
    </div>
  );
}

export default function App() {
  const { user, isLoading, isMock } = useLiff();

  if (isLoading) return <LoadingScreen />;

  return (
    <BrowserRouter>
      <Sidebar />
      <AppRoutes user={user} isMock={isMock} />
    </BrowserRouter>
  );
}
