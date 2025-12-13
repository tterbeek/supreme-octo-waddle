import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import HeaderLogo from "./HeaderLogo";
import HamburgerButton from "../components/HamburgerButton";
import { usePwaInstallBanner } from "../hooks/usePwaInstallBanner";
import PwaInstallBanner from "./PwaInstallBanner";

export default function Layout({
  children,
  menuOpen,
  setMenuOpen,
}: {
  children: ReactNode;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
}) {
  const { showBanner, handleInstallClick, handleDismiss } =
    usePwaInstallBanner();

  return (
    <div className="relative min-h-screen bg-movenotes-bg">
      
      {/* 🔥 Global hamburger - pinned to viewport left */}
<div className="fixed top-4 left-4 z-60">
  <HamburgerButton open={menuOpen} onClick={() => setMenuOpen((v) => !v)} />
</div>


      {/* 🟡 Centered content (restore your original width) */}
      <div className="
        mx-auto 
        w-full 
        max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl 
        px-4 pt-2
      ">
        {/* Center logo */}
        <div className="flex justify-center">
          <HeaderLogo delay={0} />
        </div>

        {/* Page content */}
        <div className="mt-1">
          {children}
        </div>
      </div>

      {/* Global sidebar */}
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      {showBanner && (
        <PwaInstallBanner
          onInstall={handleInstallClick}
          onDismiss={handleDismiss}
        />
      )}
    </div>
  );
}
