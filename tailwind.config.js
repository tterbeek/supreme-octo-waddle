export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
extend: {
  keyframes: {
    fadeIn: {
      "0%": { opacity: 0 },
      "100%": { opacity: 1 }
    },
    pulseTap: {
      "0%": { transform: "scale(1)" },
      "50%": { transform: "scale(0.96)" },
      "100%": { transform: "scale(1)" }
    },
    slideUp: {
      "0%": { transform: "translateY(12px)" },
      "100%": { transform: "translateY(0)" }
    }
  },
  animation: {
    fadeIn: "fadeIn 0.25s ease",
    pulseTap: "pulseTap 150ms ease-out",
    slideUp: "slideUp 0.25s ease-out"
  }
},
  },
  plugins: [],
};
