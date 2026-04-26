interface Props {
  status: 'in-stock' | 'out' | 'sold';
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'sm' }: Props) {
  const base = 'inline-flex items-center font-medium tracking-widest uppercase rounded-sm';
  const sz = size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-1';
  const variant =
    status === 'in-stock' ? 'bg-ink text-paper' :
    status === 'sold'     ? 'bg-charcoal text-paper/70' :
                            'bg-transparent text-ash border border-smoke';
  const label =
    status === 'in-stock' ? '在庫' :
    status === 'sold'     ? '已售出' :
                            '已出庫';

  return <span className={`${base} ${sz} ${variant}`}>{label}</span>;
}
