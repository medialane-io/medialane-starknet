import type { Config } from "tailwindcss";
import medialanePreset from "@medialane/ui/preset";

const config: Config = {
	darkMode: ["class"],
	presets: [medialanePreset],
	content: [
		"./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/components/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/app/**/*.{js,ts,jsx,tsx,mdx}",
		"./node_modules/@medialane/ui/dist/**/*.{js,cjs}",
	],
	theme: {
		extend: {
			fontFamily: {
				sans: [
					"Inter",
					"sans-serif"
				],
			},

			/* ═══════════════════════════════════════════
			   M3 Color Roles
			   All reference CSS variables from globals.css
			   ═══════════════════════════════════════════ */
			colors: {
				// ── Brand palette (matches medialane-io) ──
				brand: {
					blue:   "hsl(var(--brand-blue))",
					navy:   "hsl(var(--brand-navy))",
					rose:   "hsl(var(--brand-rose))",
					purple: "hsl(var(--brand-purple))",
					orange: "hsl(var(--brand-orange))",
				},

				// ── M3 Primary ──
				"m3-primary": "hsl(var(--m3-primary))",
				"m3-on-primary": "hsl(var(--m3-on-primary))",
				"m3-primary-container": "hsl(var(--m3-primary-container))",
				"m3-on-primary-container": "hsl(var(--m3-on-primary-container))",

				// ── M3 Secondary ──
				"m3-secondary": "hsl(var(--m3-secondary))",
				"m3-on-secondary": "hsl(var(--m3-on-secondary))",
				"m3-secondary-container": "hsl(var(--m3-secondary-container))",
				"m3-on-secondary-container": "hsl(var(--m3-on-secondary-container))",

				// ── M3 Tertiary ──
				"m3-tertiary": "hsl(var(--m3-tertiary))",
				"m3-on-tertiary": "hsl(var(--m3-on-tertiary))",
				"m3-tertiary-container": "hsl(var(--m3-tertiary-container))",
				"m3-on-tertiary-container": "hsl(var(--m3-on-tertiary-container))",

				// ── M3 Error ──
				"m3-error": "hsl(var(--m3-error))",
				"m3-on-error": "hsl(var(--m3-on-error))",
				"m3-error-container": "hsl(var(--m3-error-container))",
				"m3-on-error-container": "hsl(var(--m3-on-error-container))",

				// ── M3 Surfaces ──
				"m3-surface": "hsl(var(--m3-surface))",
				"m3-on-surface": "hsl(var(--m3-on-surface))",
				"m3-surface-variant": "hsl(var(--m3-surface-variant))",
				"m3-on-surface-variant": "hsl(var(--m3-on-surface-variant))",
				"m3-surface-container-lowest": "hsl(var(--m3-surface-container-lowest))",
				"m3-surface-container-low": "hsl(var(--m3-surface-container-low))",
				"m3-surface-container": "hsl(var(--m3-surface-container))",
				"m3-surface-container-high": "hsl(var(--m3-surface-container-high))",
				"m3-surface-container-highest": "hsl(var(--m3-surface-container-highest))",
				"m3-surface-dim": "hsl(var(--m3-surface-dim))",
				"m3-surface-bright": "hsl(var(--m3-surface-bright))",

				// ── M3 Outline ──
				"m3-outline": "hsl(var(--m3-outline))",
				"m3-outline-variant": "hsl(var(--m3-outline-variant))",

				// ── M3 Inverse ──
				"m3-inverse-surface": "hsl(var(--m3-inverse-surface))",
				"m3-inverse-on-surface": "hsl(var(--m3-inverse-on-surface))",
				"m3-inverse-primary": "hsl(var(--m3-inverse-primary))",

				// ── M3 Scrim ──
				"m3-scrim": "hsl(var(--m3-scrim))",

				// ── Legacy shadcn/ui compat ──
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
				popover: {
					DEFAULT: "hsl(var(--popover))",
					foreground: "hsl(var(--popover-foreground))",
				},
				card: {
					DEFAULT: "hsl(var(--card))",
					foreground: "hsl(var(--card-foreground))",
				},
				border: "hsl(var(--border))",
				input: "hsl(var(--input))",
				ring: "hsl(var(--ring))",
				sidebar: {
					DEFAULT: "hsl(var(--sidebar-background))",
					foreground: "hsl(var(--sidebar-foreground))",
					primary: "hsl(var(--sidebar-primary))",
					"primary-foreground": "hsl(var(--sidebar-primary-foreground))",
					accent: "hsl(var(--sidebar-accent))",
					"accent-foreground": "hsl(var(--sidebar-accent-foreground))",
					border: "hsl(var(--sidebar-border))",
					ring: "hsl(var(--sidebar-ring))",
				},
			},

			/* ═══════════════════════════════════════════
			   M3 Elevation Shadows
			   Tinted with brand hues (Blue & Mauve) for vibrant depth
			   ═══════════════════════════════════════════ */
			boxShadow: {
				"m3-1": "0 1px 3px 1px rgba(37,99,235,0.06), 0 1px 2px 0 rgba(147,86,193,0.04)",
				"m3-2": "0 2px 6px 2px rgba(37,99,235,0.08), 0 1px 2px 0 rgba(147,86,193,0.05)",
				"m3-3": "0 4px 8px 3px rgba(37,99,235,0.10), 0 1px 3px 0 rgba(147,86,193,0.06)",
				"m3-4": "0 6px 10px 4px rgba(37,99,235,0.12), 0 2px 3px 0 rgba(147,86,193,0.08)",
				"m3-5": "0 8px 12px 6px rgba(37,99,235,0.14), 0 4px 4px 0 rgba(147,86,193,0.10)",
				// Vivid Glows
				"glow-blue": "0 0 15px rgba(37,99,235,0.25), 0 0 45px rgba(37,99,235,0.10)",
				"glow-mauve": "0 0 15px rgba(147,86,193,0.25), 0 0 45px rgba(147,86,193,0.10)",
				"glow-orange": "0 0 15px rgba(249,115,22,0.25), 0 0 45px rgba(249,115,22,0.10)",
				"glow-mixed": "0 4px 20px rgba(37,99,235,0.15), 0 8px 40px rgba(147,86,193,0.10), 0 2px 10px rgba(249,115,22,0.05)",
			},

			/* ═══════════════════════════════════════════
			   M3 Shape Tokens
			   ═══════════════════════════════════════════ */
			borderRadius: {
				"m3-xs": "4px",
				"m3-sm": "8px",
				"m3-md": "12px",
				"m3-lg": "16px",
				"m3-xl": "28px",
				"m3-2xl": "32px",
				"m3-full": "9999px",
				// Legacy shadcn
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
			},

			/* ═══════════════════════════════════════════
			   M3 Motion (CSS-level)
			   ═══════════════════════════════════════════ */
			transitionTimingFunction: {
				"m3-standard": "cubic-bezier(0.2, 0, 0, 1)",
				"m3-decelerate": "cubic-bezier(0, 0, 0, 1)",
				"m3-accelerate": "cubic-bezier(0.3, 0, 1, 1)",
			},
			transitionDuration: {
				"m3-short": "200ms",
				"m3-medium": "300ms",
				"m3-long": "500ms",
			},

			/* ═══════════════════════════════════════════
			   Keyframes
			   ═══════════════════════════════════════════ */
			keyframes: {
				"accordion-down": {
					from: { height: "0" },
					to: { height: "var(--radix-accordion-content-height)" },
				},
				"accordion-up": {
					from: { height: "var(--radix-accordion-content-height)" },
					to: { height: "0" },
				},
				"m3-fade-in": {
					from: { opacity: "0" },
					to: { opacity: "1" },
				},
				"m3-slide-up": {
					from: { opacity: "0", transform: "translateY(16px)" },
					to: { opacity: "1", transform: "translateY(0)" },
				},
				"shimmer": {
					"0%": { backgroundPosition: "-200% 0" },
					"100%": { backgroundPosition: "200% 0" },
				},
				"pulse-glow": {
					"0%, 100%": { opacity: "0.6" },
					"50%": { opacity: "1" },
				},
				"float": {
					"0%, 100%": { transform: "translateY(0)" },
					"50%": { transform: "translateY(-4px)" },
				},
				"scale-in": {
					from: { opacity: "0", transform: "scale(0.95)" },
					to: { opacity: "1", transform: "scale(1)" },
				},
			},
			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
				"m3-fade-in": "m3-fade-in 0.3s cubic-bezier(0.2, 0, 0, 1)",
				"m3-slide-up": "m3-slide-up 0.4s cubic-bezier(0.2, 0, 0, 1)",
				"shimmer": "shimmer 2s linear infinite",
				"pulse-glow": "pulse-glow 2s ease-in-out infinite",
				"float": "float 3s ease-in-out infinite",
				"scale-in": "scale-in 0.2s ease-out",
			},
		},
	},
	plugins: [require("tailwindcss-animate")],
};
export default config;