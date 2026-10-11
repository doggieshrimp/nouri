import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nouri.dailylog',
  appName: 'Daily Log',
  webDir: 'dist',
  backgroundColor: '#FAF8F3',
  plugins: {
    SystemBars: {
      // MainActivity pads the web view natively instead (consistent on every WebView version).
      insetsHandling: 'disable',
      // Dark status bar icons on the light paper background.
      style: 'LIGHT',
    },
  },
};

export default config;
