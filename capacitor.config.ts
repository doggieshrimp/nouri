import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nouri.dailylog',
  appName: 'Daily Log',
  webDir: 'dist',
  backgroundColor: '#FAF8F3',
  plugins: {
    SystemBars: {
      // Injects --safe-area-inset-* CSS variables, which older Android WebViews lack.
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      // Dark status bar icons on the light paper background.
      style: 'LIGHT',
    },
  },
};

export default config;
