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
    // Use a fresh local origin for v1.0.1 so broken service-worker caches from
    // the first APK cannot keep serving its failed JavaScript bundle.
    androidScheme: 'http',
  },
}

export default config
