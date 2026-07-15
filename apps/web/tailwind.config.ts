import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        surface: {
          DEFAULT: "hsl(var(--surface))",
          dim: "hsl(var(--surface-dim))",
          bright: "hsl(var(--surface-bright))",
          "container-lowest": "hsl(var(--surface-container-lowest))",
          "container-low": "hsl(var(--surface-container-low))",
          container: "hsl(var(--surface-container))",
          "container-high": "hsl(var(--surface-container-high))",
          "container-highest": "hsl(var(--surface-container-highest))",
        },
        "surface-variant": "hsl(var(--surface-variant))",
        "on-surface": {
          DEFAULT: "hsl(var(--on-surface))",
          variant: "hsl(var(--on-surface-variant))",
        },
        outline: {
          DEFAULT: "hsl(var(--outline))",
          variant: "hsl(var(--outline-variant))",
        },
        "primary-container": "hsl(var(--primary-container))",
        "on-primary": {
          DEFAULT: "hsl(var(--on-primary))",
          container: "hsl(var(--on-primary-container))",
        },
        "primary-fixed": {
          DEFAULT: "hsl(var(--primary-fixed))",
          dim: "hsl(var(--primary-fixed-dim))",
        },
        "secondary-container": "hsl(var(--secondary-container))",
        "on-secondary": {
          DEFAULT: "hsl(var(--on-secondary))",
          container: "hsl(var(--on-secondary-container))",
        },
        "secondary-fixed": {
          DEFAULT: "hsl(var(--secondary-fixed))",
          dim: "hsl(var(--secondary-fixed-dim))",
        },
        tertiary: {
          DEFAULT: "hsl(var(--tertiary))",
          foreground: "hsl(var(--tertiary-foreground))",
          container: "hsl(var(--tertiary-container))",
        },
        "on-tertiary": {
          DEFAULT: "hsl(var(--on-tertiary))",
          container: "hsl(var(--on-tertiary-container))",
          fixed: "hsl(var(--on-tertiary-fixed))",
        },
        "tertiary-fixed": {
          DEFAULT: "hsl(var(--tertiary-fixed))",
          dim: "hsl(var(--tertiary-fixed-dim))",
        },
        error: {
          DEFAULT: "hsl(var(--error))",
          foreground: "hsl(var(--error-foreground))",
          container: "hsl(var(--error-container))",
        },
        "on-error": {
          DEFAULT: "hsl(var(--on-error))",
          container: "hsl(var(--on-error-container))",
        },
        inverse: {
          surface: "hsl(var(--inverse-surface))",
          "on-surface": "hsl(var(--inverse-on-surface))",
          primary: "hsl(var(--inverse-primary))",
        },
        brand: {
          blue: "hsl(var(--primary))",
          red: "hsl(var(--secondary))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) + 2px)",
        sm: "var(--radius)",
        xl: "calc(var(--radius) + 6px)",
        "2xl": "calc(var(--radius) + 10px)",
        full: "0.75rem",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.05)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)",
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        gutter: "16px",
        "container-margin": "24px",
      },
      fontSize: {
        "label-sm": ["12px", { lineHeight: "16px", fontWeight: "500" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "title-md": ["18px", { lineHeight: "26px", fontWeight: "600" }],
        "headline-lg": ["24px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-xl": ["36px", { lineHeight: "44px", letterSpacing: "-0.02em", fontWeight: "700" }],
      },
      keyframes: {
        "slide-in": {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "slide-in": "slide-in 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
