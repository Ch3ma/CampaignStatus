import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/CampaignStatus/' : '/',
  plugins: [react()],
  publicDir: false,
  server: {
    fs: {
      deny: [
        '.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.firebase/**', '**/.firebase-emulators.json', '**/AGENTS.md',
        '**/*.[pP][dD][fF]', '**/private-handouts/**',
      ],
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@firebase/firestore/')) return 'firestore';
          if (id.includes('/node_modules/@firebase/auth/')) return 'firebase-auth';
        },
        onlyExplicitManualChunks: true,
      },
    },
  },
}));
