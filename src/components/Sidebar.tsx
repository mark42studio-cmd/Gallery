import { NavLink } from 'react-router-dom';
import { LayoutGrid, Archive, Settings } from 'lucide-react';

const LINKS = [
  { to: '/',          label: 'Collection', labelZh: '首頁',   Icon: LayoutGrid },
  { to: '/inventory', label: 'Inventory',  labelZh: '庫存管理', Icon: Archive   },
  { to: '/settings',  label: 'Settings',   labelZh: '系統設定', Icon: Settings  },
];

export default function Sidebar() {
  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-64 flex-col bg-paper border-r border-smoke">

      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div className="px-7 py-8 shrink-0 border-b border-smoke/60">
        <p className="font-display text-[1.6rem] font-semibold text-ink tracking-tight leading-none">
          Gallery
        </p>
        <p className="text-[9px] text-ash uppercase tracking-[0.22em] mt-2">
          Management System
        </p>
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {LINKS.map(({ to, label, labelZh, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3.5 px-4 py-3 min-h-[44px] rounded-lg transition-colors duration-150 group ${
                isActive
                  ? 'bg-ink text-paper'
                  : 'text-ash hover:bg-mist hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={17}
                  strokeWidth={isActive ? 2.5 : 1.75}
                  className="shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-none">{label}</p>
                  <p className={`text-[10px] mt-1 leading-none tracking-wide ${
                    isActive ? 'text-paper/55' : 'text-ash/70 group-hover:text-ash'
                  }`}>
                    {labelZh}
                  </p>
                </div>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="px-7 py-5 shrink-0 border-t border-smoke/60 space-y-1">
        <p className="text-[9px] text-ash/60 uppercase tracking-[0.15em] leading-relaxed">
          Gallery Management System
        </p>
        <p className="text-[9px] text-ash/35 leading-relaxed">
          Designed by 一圈工作室 &middot; v1.0.0
        </p>
      </div>

    </aside>
  );
}
