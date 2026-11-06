import type { Config } from "tailwindcss";
import medialanePreset from "@medialane/ui/preset";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
	presets: [medialanePreset],
	content: [
		"./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/components/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/app/**/*.{js,ts,jsx,tsx,mdx}",
		"./node_modules/@medialane/ui/dist/**/*.{js,cjs}",
	],
	plugins: [tailwindcssAnimate],
};
export default config;
