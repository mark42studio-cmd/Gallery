import { NavLink } from 'react-router-dom';
import { LayoutGrid, Archive, Settings } from 'lucide-react';

const LINKS = [
  { to: '/', label: '首頁', Icon: LayoutGrid },
  { to: '/inventory', label: '庫存管理', Icon: Archive },
  { to: '/settings', label: '系統設定', Icon: Settings },
];

export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-[min(calc(100%-2rem),28rem)]">
      <div className="flex bg-white/90 backdrop-blur-md border border-smoke rounded-full shadow-lifted overflow-hidden">
        {LINKS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
                isActive ? 'text-ink' : 'text-ash hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
                <span className={`text-[10px] tracking-wide ${isActive ? 'font-semibold' : 'font-normal'}`}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
