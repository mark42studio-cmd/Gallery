interface Props {
  status: 'in-stock' | 'out';
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'sm' }: Props) {
  const isIn = status === 'in-stock';
  const base = 'inline-flex items-center font-medium tracking-widest uppercase rounded-sm';
  const sz = size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-1';
  const variant = isIn
    ? 'bg-ink text-paper'
    : 'bg-transparent text-ash border border-smoke';

  return (
    <span className={`${base} ${sz} ${variant}`}>
      {isIn ? '在庫' : '已出庫'}
    </span>
  );
}
