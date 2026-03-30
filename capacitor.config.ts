import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.movenotes',
  appName: 'MoveNotes',
  webDir: 'dist',
  server: {
    url: "https://movenotes.app",
    cleartext: false
  }
};

export default config;
