import { motion } from "framer-motion";

export default function AnimatedLogo() {
  const moveText = "Move";
  const notesText = "Notes";

  return (
    <div className="flex items-center justify-center h-screen bg-movenotes-bg">
      <motion.h1
        className="text-6xl font-[Poppins] tracking-tight"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {/* Move (Sans-serif, forest green) */}
        {moveText.split("").map((char, index) => (
          <motion.span
            key={`m-${index}`}
            className="text-movenotes-primary"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: index * 0.1,
              duration: 0.4,
              ease: "easeOut",
            }}
          >
            {char}
          </motion.span>
        ))}

        {/* Notes (Serif / coral) */}
        {notesText.split("").map((char, index) => (
          <motion.span
            key={`n-${index}`}
            className="text-movenotes-accent font-[DMSerifDisplay] italic"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: (moveText.length + index) * 0.1,
              duration: 0.4,
              ease: "easeOut",
            }}
          >
            {char}
          </motion.span>
        ))}
      </motion.h1>
    </div>
  );
}
