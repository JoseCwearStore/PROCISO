interface ProgressBarProps {
  value: number
  max?: number
  size?: 'sm' | 'md'
  showLabel?: boolean
  color?: 'blue' | 'green' | 'amber' | 'red'
}

const colorClasses = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
}

const heightClasses = {
  sm: 'h-1.5',
  md: 'h-2',
}

export function ProgressBar({
  value,
  max = 100,
  size = 'sm',
  showLabel = false,
  color = 'blue',
}: ProgressBarProps) {
  const pct = Math.min(Math.round((value / max) * 100), 100)
  const barColor = pct === 100 ? 'bg-green-500' : pct >= 50 ? colorClasses[color] : colorClasses.amber

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 bg-slate-200 rounded-full overflow-hidden ${heightClasses[size]}`}>
        <div
          className={`${heightClasses[size]} rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-slate-600 w-8 text-right">{pct}%</span>
      )}
    </div>
  )
}
