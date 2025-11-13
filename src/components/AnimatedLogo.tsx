import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import FontFaceObserver from "fontfaceobserver";

export default function AnimatedLogo() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    const nunito = new FontFaceObserver("Nunito Sans");
    const playfair = new FontFaceObserver("Playfair Display");

    Promise.all([nunito.load(), playfair.load()]).then(() => {
      setFontsLoaded(true);
    });
  }, []);

  if (!fontsLoaded) {
    // Optional: blank background or loader while fonts load
    return <div className="h-screen bg-movenotes-bg" />;
  }

  // Now safely render your animated logo (same code as before)
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-movenotes-bg">
      <motion.h1
        className="text-6xl font-nunito tracking-tight"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {"Move".split("").map((char, i) => (
          <motion.span
            key={`m-${i}`}
            className="text-movenotes-primary font-bold"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: i * 0.15,
              duration: 0.4,
              ease: "easeOut",
            }}
          >
            {char}
          </motion.span>
        ))}

        {"Notes".split("").map((char, i) => (
          <motion.span
            key={`n-${i}`}
            className="text-movenotes-accent font-playfair italic"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: (4 + i) * 0.15,
              duration: 0.4,
              ease: "easeOut",
            }}
          >
            {char}
          </motion.span>
        ))}
      </motion.h1>

      <motion.p
        className="mt-4 text-lg text-movenotes-muted font-nunito"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: 1.5,
          duration: 0.8,
          ease: "easeOut",
        }}
      >
        Move. Log. Reflect.
      </motion.p>
    </div>
  );
}
