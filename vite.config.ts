import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite"; // Ensure this is here

// [vite.dev](https://vite.dev/config/)
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Ensure this is here
  ],
});
