import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import HeaderLogo from "./HeaderLogo";
import HamburgerButton from "../components/HamburgerButton";
import { usePwaInstallBanner } from "../hooks/usePwaInstallBanner";
import PwaInstallBanner from "./PwaInstallBanner";

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

  const navItems = [
    { to: "/", label: "Journal" },
    { to: "/stats", label: "Insights" },
  ];

  return (
    <div className="relative min-h-screen bg-movenotes-bg">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-movenotes-bg/95 backdrop-blur border-b border-movenotes-border">
        <div className="relative h-14">
          {showHamburger && (
            <div className="fixed left-4 top-0 z-60 h-14 flex items-center">
              <HamburgerButton open={menuOpen} onClick={() => setMenuOpen(!menuOpen)} />
            </div>
          )}

          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div id="layout-top-right-slot" className="flex justify-end" />
          </div>

          <div
            id="layout-search-layer"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
          />

          <div className="mx-auto w-full max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl px-4 h-full flex items-center justify-center">
            {showHeaderLogo && (
              <div id="layout-header-logo" className="flex justify-center">
                <HeaderLogo />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🟡 Centered content (restore your original width) */}
      <div
        className="
        mx-auto 
        w-full 
        max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl 
        px-4 pt-12 pb-20
      "
      >
        {/* Page content */}
        <div className="mt-0.5">{children}</div>
      </div>

      {/* Global sidebar */}
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-movenotes-bg/95 backdrop-blur border-t-[3px] border-movenotes-border shadow-[0_-4px_14px_rgba(0,0,0,0.09)]">
        <div className="mx-auto max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl px-6 py-3 flex items-center gap-4">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.to ||
              location.pathname.startsWith(`${item.to}/`) ||
              (item.to === "/stats" && location.pathname.startsWith("/stats-"));

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex-1 text-center text-sm font-medium rounded-full py-2 transition ${
                  isActive
                    ? "bg-movenotes-primary/15 text-movenotes-primary shadow-sm border border-movenotes-primary/20"
                    : "text-movenotes-text/80 hover:text-movenotes-text bg-transparent"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {showBanner && (
        <PwaInstallBanner
          onInstall={handleInstallClick}
          onDismiss={handleDismiss}
        />
      )}
    </div>
  );
}
