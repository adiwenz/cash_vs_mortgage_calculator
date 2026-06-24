
export default function LifeProfileTabs({ tabs, activeTab, setActiveTab, isMobile }) {
  if (isMobile) {
    return (
      <div className="life-profile-tabs-row" style={{ display: 'flex', overflowX: 'auto', padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color, #e5e7eb)', gap: '0.5rem', background: '#ffffff' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            className={`life-profile-tab-button ${activeTab === t.id ? 'active' : ''}`}
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="life-profile-tabs-row" style={{ padding: '0.5rem 1.5rem', borderBottom: '1px solid var(--border-color, #e5e7eb)', background: '#ffffff' }}>
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          className={`life-profile-tab-button ${activeTab === t.id ? 'active' : ''}`}
          onClick={() => setActiveTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
