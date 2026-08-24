import { NEWS_STATUS_COLORS, NEWS_STATUS_LABELS } from '@/lib/news-labels';
import { NewsStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: NewsStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const color = NEWS_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800';
  const label = NEWS_STATUS_LABELS[status] ?? status;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}