import HeaderLogo from "./HeaderLogo";
import HamburgerButton from "./HamburgerButton";

export default function AppHeader({
  menuOpen,
  onToggleMenu,
  showHamburger = true,
  showHeaderLogo = true,
}: {
  menuOpen: boolean;
  onToggleMenu: () => void;
  showHamburger?: boolean;
  showHeaderLogo?: boolean;
}) {
  return (
    <div className="bg-movenotes-bg/95 backdrop-blur border-b border-movenotes-border">
      <div className="relative h-14">
        {showHamburger && (
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-14 flex items-center"
            style={{ paddingLeft: "calc(24px + env(safe-area-inset-left))" }}
          >
            <HamburgerButton open={menuOpen} onClick={onToggleMenu} />
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
  );
}
