/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        theme: {
          cream: "#FDFBF7",
          blue: "#1e3a8a",
          accent: "#CBDDE9", // New accent color provided by user
        },
        primary: {
          blue: "var(--color-primary-blue)",
        },
        ink: {
          black: "var(--color-ink-black)",
        },
        true: {
          black: "var(--color-true-black)",
        },
        paper: {
          white: "var(--color-paper-white)",
        },
        mist: {
          gray: "var(--color-mist-gray)",
        },
        cloud: {
          gray: "var(--color-cloud-gray)",
        },
      },
      fontFamily: {
        sans: ["'Inter'", "sans-serif"],
        serif: ["'Quintessential'", "cursive"],
      },
      fontSize: {
        caption: ["var(--text-caption)", { lineHeight: "var(--leading-caption)", letterSpacing: "var(--tracking-caption)" }],
        body: ["var(--text-body)", { lineHeight: "var(--leading-body)", letterSpacing: "var(--tracking-body)" }],
        subheading: ["var(--text-subheading)", { lineHeight: "var(--leading-subheading)", letterSpacing: "var(--tracking-subheading)" }],
        "heading-sm": ["var(--text-heading-sm)", { lineHeight: "var(--leading-heading-sm)", letterSpacing: "var(--tracking-heading-sm)" }],
        heading: ["var(--text-heading)", { lineHeight: "var(--leading-heading)", letterSpacing: "var(--tracking-heading)" }],
        display: ["var(--text-display)", { lineHeight: "var(--leading-display)", letterSpacing: "var(--tracking-display)" }],
      },
      borderRadius: {
        tags: "var(--radius-tags)",
        cards: "var(--radius-cards)",
        inputs: "var(--radius-inputs)",
        buttons: "var(--radius-buttons)",
        largecontainers: "var(--radius-largecontainers)",
      },
      boxShadow: {
        "sm-2": "var(--shadow-sm-2)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
