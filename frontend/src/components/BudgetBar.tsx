import { budgetStatus } from '../lib/budget';
import { formatCurrency, formatPercent } from '../lib/format';
import { AlertIcon, CheckCircleIcon } from './Icons';

interface Props {
  name: string;
  icon: string | null;
  spent: number;
  budget: number;
  compact?: boolean; // dashboard card: no percentage column
}

// One budget's progress: name, "₹spent of ₹limit", bar, and a worded status with icon
export default function BudgetBar({ name, icon, spent, budget, compact }: Props) {
  const { ratio, level, label } = budgetStatus(spent, budget);
  const StatusIcon = level === 'ok' ? CheckCircleIcon : AlertIcon;

  return (
    <div className={`budget-bar budget-${level}`}>
      <div className="budget-bar-head">
        <span className="budget-bar-name">
          <span aria-hidden="true">{icon}</span> {name}
        </span>
        <span className="budget-bar-amounts">
          <b>{formatCurrency(spent)}</b> of {formatCurrency(budget)}
        </span>
      </div>
      <div
        className="budget-track"
        role="progressbar"
        aria-label={`${name} budget used`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(ratio, 1) * 100)}
        aria-valuetext={`${formatPercent(ratio)} used, ${label}`}
      >
        <span style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
      </div>
      <p className="budget-status">
        <StatusIcon />
        <span>{level === 'warning' ? `Almost there · ${label}` : label}</span>
        {!compact && <span className="budget-pct">{formatPercent(ratio)} used</span>}
      </p>
    </div>
  );
}
