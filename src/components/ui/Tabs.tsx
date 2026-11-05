import React, { useState } from 'react'

interface Tab {
  id: string
  label: string
  icon?: React.ReactNode
  badge?: number
}

interface TabsProps {
  tabs: Tab[]
  defaultTab?: string
  onChange?: (id: string) => void
  children?: (activeTab: string) => React.ReactNode
}

export function Tabs({ tabs, defaultTab, onChange, children }: TabsProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id ?? '')

  function handleChange(id: string) {
    setActive(id)
    onChange?.(id)
  }

  return (
    <div>
      <div className="flex border-b border-slate-200 gap-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleChange(tab.id)}
            className={`
              flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${
                active === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }
            `}
          >
            {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="ml-1 bg-slate-100 text-slate-600 text-xs rounded-full px-1.5 py-0.5 font-medium min-w-[1.25rem] text-center">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      {children && <div className="mt-4">{children(active)}</div>}
    </div>
  )
}
