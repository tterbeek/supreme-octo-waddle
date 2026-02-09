import { motion } from "framer-motion";

export default function HamburgerButton({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative w-8 h-8 flex flex-col justify-center items-start"
    >
      {/* Top bar */}
      <motion.div
        animate={open ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-6 h-0.5 bg-black"
      />

      {/* Middle bar */}
      <motion.div
        animate={open ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="w-6 h-0.5 bg-black my-1"
      />

      {/* Bottom bar */}
      <motion.div
        animate={open ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-6 h-0.5 bg-black"
      />
    </button>
  );
}
