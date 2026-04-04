type Page = "analysis" | "research";

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const MENU_ITEMS: { page: Page; label: string; icon: string }[] = [
  { page: "analysis", label: "分析・バックテスト", icon: "📈" },
  { page: "research", label: "リサーチ", icon: "🔬" },
];

export function Sidebar({ currentPage, onNavigate, isOpen, onToggle }: SidebarProps) {
  function handleNav(page: Page) {
    onNavigate(page);
    onToggle();
  }

  return (
    <>
      {isOpen && (
        <div className="sidebar-overlay" onClick={onToggle} />
      )}
      <nav className={`sidebar${isOpen ? " sidebar-open" : ""}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">MT5 Lab</span>
        </div>
        <ul className="sidebar-menu">
          {MENU_ITEMS.map(({ page, label, icon }) => (
            <li key={page}>
              <button
                className={`sidebar-item${currentPage === page ? " sidebar-item-active" : ""}`}
                onClick={() => handleNav(page)}
              >
                <span className="sidebar-icon">{icon}</span>
                <span>{label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
