import { STATUT_COLORS } from '../utils/constants';

interface StatusBadgeProps {
  statut: string;
  className?: string;
}

export default function StatusBadge({ statut, className = '' }: StatusBadgeProps) {
  const colors = STATUT_COLORS[statut] || { bg: 'bg-gray-100', text: 'text-gray-700' };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text} ${className}`}
    >
      {statut}
    </span>
  );
}
