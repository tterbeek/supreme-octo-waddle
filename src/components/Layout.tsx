import { type ReactNode } from "react";
import Sidebar from "./Sidebar";
import HeaderLogo from "./HeaderLogo";
import HamburgerButton from "../components/HamburgerButton";

export default function Layout({
  children,
  menuOpen,
  setMenuOpen,
}: {
  children: ReactNode;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
}) {
  return (
    <div className="relative min-h-screen bg-movenotes-bg">
      
      {/* 🔥 Global hamburger - pinned to viewport left */}
<div className="fixed top-4 left-4 z-50">
  <HamburgerButton open={menuOpen} onClick={() => setMenuOpen(true)} />
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
    </div>
  );
}
