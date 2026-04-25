import type { LiffUser } from '../types';

interface HeaderProps {
  user: LiffUser | null;
  isMock: boolean;
  title?: string;
}

export default function Header({ user, isMock, title = 'Gallery' }: HeaderProps) {
  const initials = user?.displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? 'G';

  return (
    <header className="sticky top-0 z-30 bg-paper border-b border-smoke pt-safe">
      <div className="flex items-center justify-between px-5 h-14">
        <h1 className="font-display text-xl font-semibold tracking-tight text-ink">
          {title}
        </h1>

        <div className="flex items-center gap-2">
          {isMock && (
            <span className="text-[10px] font-medium tracking-widest uppercase text-ash border border-smoke rounded-full px-2 py-0.5">
              Dev
            </span>
          )}
          {user ? (
            user.pictureUrl ? (
              <img
                src={user.pictureUrl}
                alt={user.displayName}
                className="w-8 h-8 rounded-full object-cover ring-1 ring-smoke"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-ink flex items-center justify-center ring-1 ring-smoke">
                <span className="text-paper text-[11px] font-semibold">{initials}</span>
              </div>
            )
          ) : (
            <div className="w-8 h-8 rounded-full bg-mist animate-pulse" />
          )}
        </div>
      </div>
    </header>
  );
}
