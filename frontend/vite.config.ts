import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Windows IPはWSL2から `ip route show default | awk '{print $3}'` で確認
// 開発時は下記をWindowsのIPに書き換える
const WINDOWS_IP = "172.25.64.1";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": `http://${WINDOWS_IP}:8001`,
    },
  },
  build: {
    outDir: "../backend/dist",
    emptyOutDir: true,
  },
});
