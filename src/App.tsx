import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useLiff } from './hooks/useLiff';
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
];

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

  const sharedProps = { user, isMock };

  return (
    <BrowserRouter>
      {/* Desktop sidebar — fixed, hidden on mobile */}
      <Sidebar />

      {/* Content area — offset right on desktop to clear the sidebar */}
      <div className="md:pl-64 min-h-screen">
        <div className="max-w-6xl mx-auto">
          <Routes>
            <Route path="/" element={<Home {...sharedProps} />} />
            <Route path="/inventory" element={<Inventory {...sharedProps} />} />
            <Route path="/settings" element={<Settings {...sharedProps} />} />
            {/* Catch-all → home */}
            <Route path="*" element={<Home {...sharedProps} />} />
          </Routes>
        </div>
      </div>

      {/* Mobile bottom nav — hidden on desktop */}
      <BottomNav />

      {/* Onboarding tour overlay */}
      <Onboarding steps={TOUR_STEPS} />
    </BrowserRouter>
  );
}
