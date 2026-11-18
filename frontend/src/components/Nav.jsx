import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import Icon from "./Icon";

// primary   -> bottom tab bar on phones, inline links on desktop
// secondary -> side drawer (opened with the hamburger)
const MENUS = {
  guest: {
    primary: [
      { to: "/", label: "Home", icon: "home", end: true },
      { to: "/scheduling", label: "Schedule", icon: "calendar" },
      { to: "/subscriptions", label: "Plans", icon: "card" },
      { to: "/chat", label: "Chat", icon: "message" },
    ],
    secondary: [],
  },
  resident: {
    primary: [
      { to: "/households", label: "Dashboard", icon: "home" },
      { to: "/scheduling", label: "Schedule", icon: "calendar" },
      { to: "/rewards", label: "Rewards", icon: "gift" },
      { to: "/chat", label: "Chat", icon: "message" },
    ],
    secondary: [
      { to: "/", label: "Home", icon: "home", end: true },
      { to: "/services", label: "My perks", icon: "star" },
      { to: "/complaints", label: "Complaints", icon: "alert" },
      { to: "/subscriptions", label: "Plans", icon: "card" },
    ],
  },
  staff: {
    primary: [
      { to: "/compliance", label: "Check desk", icon: "clipboard" },
      { to: "/complaints", label: "Complaints", icon: "alert" },
      { to: "/ward-dashboard", label: "Ward", icon: "chart" },
      { to: "/service-desk", label: "Desk", icon: "list" },
    ],
    secondary: [
      { to: "/", label: "Home", icon: "home", end: true },
      { to: "/households", label: "Households", icon: "users" },
      { to: "/scheduling", label: "Scheduling", icon: "calendar" },
      { to: "/subscriptions", label: "Plans", icon: "card" },
      { to: "/chat", label: "Chat", icon: "message" },
    ],
  },
};

const linkClass = ({ isActive }) => "nav-link" + (isActive ? " active" : "");
const tabClass = ({ isActive }) => "tab" + (isActive ? " active" : "");

export default function Nav({ loggedIn, isStaff, ready, onLogout }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const closeRef = useRef(null);

  // While we're still finding out whether a logged-in user is staff, show
  // just the brand, so staff never see a flash of the resident menu.
  const resolving = loggedIn && !ready;
  const menu = !loggedIn ? MENUS.guest : isStaff ? MENUS.staff : MENUS.resident;

  useEffect(() => { setOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleLogout = () => {
    setOpen(false);
    onLogout();
  };

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">W</span>
            <span className="brand-name">Waste Warrior</span>
          </Link>

          {!resolving && (
            <nav className="header-links" aria-label="Main">
              {menu.primary.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}

          <div className="header-spacer" />

          {!resolving && (
            <div className="header-actions">
              {!loggedIn && (
                <>
                  <Link to="/login" className="btn btn-outline btn-sm">Log in</Link>
                  <Link to="/register" className="btn btn-primary btn-sm hide-on-mobile">Get started</Link>
                </>
              )}
              <button
                type="button"
                className="icon-btn"
                aria-label="Open menu"
                aria-expanded={open}
                aria-controls="app-drawer"
                onClick={() => setOpen(true)}
              >
                <Icon name="menu" />
              </button>
            </div>
          )}
        </div>
      </header>

      {!resolving && (
        <nav className="tabbar" aria-label="Quick navigation">
          {menu.primary.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={tabClass}>
              <span className="tab-icon"><Icon name={item.icon} size={20} /></span>
              <span className="tab-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      )}

      <div className={`drawer-overlay${open ? " open" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside id="app-drawer" className={`drawer${open ? " open" : ""}`} aria-label="Menu" aria-hidden={!open}>
        <div className="drawer-head">
          <span className="eyebrow">Menu</span>
          <button ref={closeRef} type="button" className="icon-btn" aria-label="Close menu" onClick={() => setOpen(false)}>
            <Icon name="x" />
          </button>
        </div>

        <nav className="drawer-links" aria-label="More">
          {menu.secondary.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              <Icon name={item.icon} size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="drawer-footer">
          {loggedIn ? (
            <button type="button" className="btn btn-outline" onClick={handleLogout}>
              <Icon name="logout" size={18} /> Log out
            </button>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline">Log in</Link>
              <Link to="/register" className="btn btn-primary">Create account</Link>
            </>
          )}
        </div>
      </aside>
    </>
  );
}