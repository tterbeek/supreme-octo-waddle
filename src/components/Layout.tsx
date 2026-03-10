import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import AppHeader from "./AppHeader";
import { usePwaInstallBanner } from "../hooks/usePwaInstallBanner";
import PwaInstallBanner from "./PwaInstallBanner";
import { LayoutChromeContext } from "../contexts/LayoutChromeContext";
import { getCurrentUser } from "../services/auth.service";
import {
  CIRCLE_ACCESS_UPDATED_EVENT,
  hasCircleAccess,
} from "../services/circle.service";

const JOURNAL_STORAGE_KEY = "movenotes_last_journal_tab";
const BOTTOM_STORAGE_KEY = "movenotes_last_bottom_tab";

const getStoredJournalTab = () => {
  if (typeof window === "undefined") return "/";
  const stored = localStorage.getItem(JOURNAL_STORAGE_KEY);
  if (stored === "/calendar" || stored === "/photos" || stored === "/") {
    return stored;
  }
  return "/";
};

const isJournalRoutePath = (pathname: string) =>
  pathname === "/" ||
  pathname.startsWith("/calendar") ||
  pathname.startsWith("/photos") ||
  pathname.startsWith("/home-legacy") ||
  pathname.startsWith("/home-rpc");

const getJournalPathForStorage = (pathname: string) => {
  if (pathname.startsWith("/calendar")) return "/calendar";
  if (pathname.startsWith("/photos")) return "/photos";
  return "/";
};

export default function Layout({
  children,
  menuOpen,
  setMenuOpen,
  showHamburger = true,
  showHeaderLogo = true,
}: {
  children: ReactNode;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
  showHamburger?: boolean;
  showHeaderLogo?: boolean;
}) {
  const { showBanner, handleInstallClick, handleDismiss } =
    usePwaInstallBanner();
  const location = useLocation();
  const navigate = useNavigate();
  const [chromeHidden, setChromeHidden] = useState(false);
  const [journalTarget, setJournalTarget] = useState(getStoredJournalTab);
  const [showCircleTab, setShowCircleTab] = useState(false);
  const initNavigationRef = useRef(false);

  const topNavItems = [
    { to: "/", label: "Journal" },
    { to: "/calendar", label: "Calendar" },
    { to: "/photos", label: "Photos" },
  ];
  const bottomNavItems = useMemo(
    () =>
      showCircleTab
        ? [
            { to: "/", label: "Journal" },
            { to: "/circle", label: "Circle" },
            { to: "/stats", label: "Insights" },
          ]
        : [
            { to: "/", label: "Journal" },
            { to: "/stats", label: "Insights" },
          ],
    [showCircleTab]
  );
  const isJournalRoute = useMemo(
    () => isJournalRoutePath(location.pathname),
    [location.pathname]
  );
  const isCircleRoute = useMemo(
    () => location.pathname.startsWith("/circle"),
    [location.pathname]
  );
  const isInsightsRoute = useMemo(
    () =>
      location.pathname.startsWith("/stats") ||
      location.pathname.startsWith("/stats-"),
    [location.pathname]
  );
  const showTopNav = isJournalRoute && !chromeHidden;
  const activeJournalTarget = isJournalRoute
    ? getJournalPathForStorage(location.pathname)
    : journalTarget;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isJournalRoute) {
      const journalPath = getJournalPathForStorage(location.pathname);
      localStorage.setItem(JOURNAL_STORAGE_KEY, journalPath);
      localStorage.setItem(BOTTOM_STORAGE_KEY, "journal");
      setJournalTarget(journalPath);
      return;
    }
    if (isInsightsRoute) {
      localStorage.setItem(BOTTOM_STORAGE_KEY, "insights");
      return;
    }
    if (isCircleRoute) {
      localStorage.setItem(BOTTOM_STORAGE_KEY, "circle");
    }
  }, [isCircleRoute, isJournalRoute, isInsightsRoute, location.pathname]);

  const refreshCircleAccess = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        setShowCircleTab(false);
        return;
      }
      const canAccess = await hasCircleAccess(user.id);
      setShowCircleTab(canAccess);
    } catch {
      setShowCircleTab(false);
    }
  }, []);

  useEffect(() => {
    void refreshCircleAccess();
  }, [location.pathname, refreshCircleAccess]);

  useEffect(() => {
    let cancelled = false;

    const handleCircleAccessUpdate = () => {
      if (!cancelled) {
        void refreshCircleAccess();
      }
    };

    window.addEventListener(CIRCLE_ACCESS_UPDATED_EVENT, handleCircleAccessUpdate);

    return () => {
      cancelled = true;
      window.removeEventListener(
        CIRCLE_ACCESS_UPDATED_EVENT,
        handleCircleAccessUpdate
      );
    };
  }, [refreshCircleAccess]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initNavigationRef.current) return;
    initNavigationRef.current = true;

    if (location.pathname !== "/") return;

    const lastBottom = localStorage.getItem(BOTTOM_STORAGE_KEY);
    if (lastBottom === "insights") {
      navigate("/stats", { replace: true });
      return;
    }

    if (lastBottom === "circle" && showCircleTab) {
      navigate("/circle", { replace: true });
      return;
    }

    if (lastBottom === "journal") {
      const storedJournal = getStoredJournalTab();
      if (storedJournal !== "/") {
        navigate(storedJournal, { replace: true });
      }
    }
  }, [location.pathname, navigate, showCircleTab]);

  return (
    <LayoutChromeContext.Provider value={{ chromeHidden, setChromeHidden }}>
      <div className="relative min-h-screen bg-movenotes-bg">
        {/* App header */}
        {!chromeHidden && (
          <AppHeader
            menuOpen={menuOpen}
            onToggleMenu={() => setMenuOpen(!menuOpen)}
            showHamburger={showHamburger}
            showHeaderLogo={showHeaderLogo}
          />
        )}

        {showTopNav && (
          <div className="sticky top-0 z-40 bg-movenotes-bg/95 backdrop-blur border-b border-movenotes-border/60">
            <nav className="mx-auto w-full max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl px-4 py-2 flex items-center gap-2">
              {topNavItems.map((item) => {
                const isActive =
                  item.to === "/"
                    ? isJournalRoute &&
                      !location.pathname.startsWith("/calendar") &&
                      !location.pathname.startsWith("/photos")
                    : location.pathname.startsWith(item.to);

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="relative flex-1 text-center text-sm font-medium pb-2 transition"
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span
                      className={
                        isActive ? "text-movenotes-text" : "text-movenotes-muted"
                      }
                    >
                      {item.label}
                    </span>
                    {isActive && (
                      <span className="absolute left-4 right-4 -bottom-0.5 h-0.5 rounded-full bg-movenotes-text/70" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {/* 🟡 Centered content (restore your original width) */}
        <div
          className="
        mx-auto 
        w-full 
        max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl 
        px-4 pb-20 pt-2
      "
        >
          {/* Page content */}
          <div className="mt-0.5">{children}</div>
        </div>

        {/* Global sidebar */}
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

        {/* Bottom nav */}
        {!chromeHidden && (
          <nav className="fixed bottom-0 left-0 right-0 z-30 bg-movenotes-bg/95 backdrop-blur border-t-[3px] border-movenotes-border shadow-[0_-4px_14px_rgba(0,0,0,0.09)]">
            <div className="mx-auto max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl px-6 py-3 flex items-center gap-4">
              {bottomNavItems.map((item) => {
                const isActive =
                  item.to === "/"
                    ? isJournalRoute
                    : item.to === "/circle"
                    ? isCircleRoute
                    : location.pathname.startsWith("/stats") ||
                      location.pathname.startsWith("/stats-");

                const handleClick = () => {
                  if (item.to === "/") {
                    navigate(activeJournalTarget);
                    return;
                  }
                  navigate(item.to);
                };

                return (
                  <button
                    key={item.to}
                    type="button"
                    onClick={handleClick}
                    className={`flex-1 text-center text-sm font-medium rounded-full py-2 transition ${
                      isActive
                        ? "bg-movenotes-primary/15 text-movenotes-primary shadow-sm border border-movenotes-primary/20"
                        : "text-movenotes-text/80 hover:text-movenotes-text bg-transparent"
                    }`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {showBanner && (
          <PwaInstallBanner
            onInstall={handleInstallClick}
            onDismiss={handleDismiss}
          />
        )}
      </div>
    </LayoutChromeContext.Provider>
  );
}
