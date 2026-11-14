import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.workoutpro.app',
  appName: 'WorkoutPro',
  webDir: 'out',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
    LocalNotifications: {
      // Monochrome status-bar icon (res/drawable/ic_stat_workoutpro.xml) tinted with the accent.
      smallIcon: 'ic_stat_workoutpro',
      iconColor: '#0071E3',
    },
  },
};

export default config;
