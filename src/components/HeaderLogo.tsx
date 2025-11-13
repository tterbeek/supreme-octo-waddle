import { motion } from "framer-motion";

export default function HeaderLogo({
  withTagline = false,
  delay = 0.1,
}: {
  withTagline?: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut", delay }}
      className="flex flex-col items-center select-none"
    >
      {/* Main Logo */}
      <h1 className="text-3xl tracking-tight">
        <span className="font-nunito font-bold text-movenotes-primary">
          Move
        </span>
        <span className="font-playfair italic text-movenotes-accent">
          Notes
        </span>
      </h1>

      {/* Optional tagline */}
      {withTagline && (
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.8,
            ease: "easeOut",
            delay: delay + 0.3,
          }}
          className="mt-1 text-sm text-movenotes-muted font-nunito"
        >
          Move. Log. Reflect.
        </motion.p>
      )}
    </motion.div>
  );
}
