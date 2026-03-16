import { Link, useLocation } from "react-router-dom";

export default function PublicTopNav() {
  const location = useLocation();

  const show =
    location.pathname === "/" ||
    location.pathname === "/login" ||
    location.pathname === "/signup" ||
    location.pathname === "/privacy" ||
    location.pathname === "/terms" ||
    location.pathname === "/about" ||
    location.pathname === "/support";

  if (!show) return null;

  return (
    <div className="absolute top-4 right-4 flex items-center space-x-2 text-sm">
      <Link to="/" className="text-movenotes-primary hover:opacity-80 transition">
        App
      </Link>
      <span className="text-movenotes-primary/70">|</span>
      <Link to="/about" className="text-movenotes-primary hover:opacity-80 transition">
        About
      </Link>
      <span className="text-movenotes-primary/70">|</span>
      <Link to="/support" className="text-movenotes-primary hover:opacity-80 transition">
        Support
      </Link>
      <span className="text-movenotes-primary/70">|</span>
      <Link to="/privacy" className="text-movenotes-primary hover:opacity-80 transition">
        Privacy
      </Link>
      <span className="text-movenotes-primary/70">|</span>
      <Link to="/terms" className="text-movenotes-primary hover:opacity-80 transition">
        Terms
      </Link>
    </div>
  );
}
