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
      
      {/* 🔥 Global hamburger - pinned to viewport left */}
      {showHamburger && (
        <div className="fixed top-4 left-4 z-60">
          <HamburgerButton open={menuOpen} onClick={() => setMenuOpen(!menuOpen)} />
        </div>
      )}

      {/* 🟡 Centered content (restore your original width) */}
      <div className="
        mx-auto 
        w-full 
        max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl 
        px-4 pt-1 pb-20
      ">
        {/* Center logo */}
        {showHeaderLogo && (
          <div id="layout-header-logo" className="flex justify-center -mt-1">
            <HeaderLogo />
          </div>
        )}

        {/* Page content */}
        <div className="mt-1">
          {children}
        </div>
      </div>

      {/* Global sidebar */}
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-movenotes-bg/95 backdrop-blur border-t border-movenotes-border">
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
