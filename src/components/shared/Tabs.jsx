import Link from 'next/link';

/** Tabs that are links, so every tab has its own address. */
export function LinkTabs({ tabs, active }) {
  return (
    <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-border" aria-label="Sections">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          scroll={false}
          aria-current={tab.id === active ? 'page' : undefined}
          className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            tab.id === active
              ? 'border-brand text-brand'
              : 'border-transparent text-muted hover:text-text'
          }`}
        >
          {tab.label}
          {tab.count ? (
            <span className="ml-1.5 rounded-full bg-brand/10 px-1.5 text-xs text-brand">
              {tab.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
