export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        warm: {
          50:  "#F3EDE4", // app background
          100: "#F3EEE8", // card background
          200: "#F4E1C8", // soft highlight (hover / subtle divider)
          300: "#EACFAE", // accent background (buttons)
          400: "#D9B88F", // border / accent
          500: "#C29C6D", // text accent (strong)
        },
                amber: {
          50:  "#E9F0ED",
          100: "#D0DDD6",
          200: "#A6C0B3",
          300: "#5A7A69", // ✅ your new primary color
          400: "#4E6A5C",
          500: "#435C51",
          600: "#374D44",
          700: "#2C3E37",
          800: "#22312C",
          900: "#182421",
                },
             accent: {
      100: "#FFF6EA", // your soft background
      200: "#F5EAD6",
        },
          primary: {
          DEFAULT: "#5A7A69",
          text: "#FDFBF9",     // ✅ button text
          textMuted: "#EAE5DF" // ✅ subtle text
        },
        movenotes: {
          bg: "#F3EDE4",        // soft sand (main background)
          surface: "#F3EEE8",   // light cards
          bgoverlay: "#F9F6F1",
          primary: "#5A7A69",   // forest green (buttons/icons)
          accent: "#E48A6C",    // warm coral (highlights)
          text: "#1C1E21",      // ink
          muted: "#8C8C8C",     // secondary text
          border: "#E1DCD3",    // soft borders
        },
      },

      keyframes: {
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        pulseTap: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(0.96)" },
          "100%": { transform: "scale(1)" },
        },
        slideUp: {
          "0%": { transform: "translateY(12px)" },
          "100%": { transform: "translateY(0)" },
        },
      },

      animation: {
        fadeIn: "fadeIn 0.25s ease",
        pulseTap: "pulseTap 150ms ease-out",
        slideUp: "slideUp 0.25s ease-out",
      },
    },
  },
  plugins: [],
};
