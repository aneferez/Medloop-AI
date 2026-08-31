import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.medloop.ai',
  appName: 'MedLoop AI',
  webDir: 'dist',
  android: {
    backgroundColor: '#000000',
  },
  plugins: {
    LocalNotifications: {
      iconColor: '#4338CA',
      sound: 'medicine_reminder.wav',
      presentationOptions: ['badge', 'sound', 'banner', 'list'],
    },
  },
  server: {
    // Keep the embedded production origin secure. Stale web assets are handled
    // by versioned builds rather than enabling cleartext HTTP in the WebView.
    androidScheme: 'https',
  },
}

export default config
