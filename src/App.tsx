import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useLiff } from './hooks/useLiff';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings';

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
      <div className="relative max-w-md mx-auto min-h-screen">
        <Routes>
          <Route path="/" element={<Home {...sharedProps} />} />
          <Route path="/inventory" element={<Inventory {...sharedProps} />} />
          <Route path="/settings" element={<Settings {...sharedProps} />} />
          {/* Catch-all → home */}
          <Route path="*" element={<Home {...sharedProps} />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}
