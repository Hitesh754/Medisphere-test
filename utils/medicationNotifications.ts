import { Platform } from 'react-native';
import Constants from 'expo-constants';

type NotificationsModule = typeof import('expo-notifications');

const isExpoGo = Constants.executionEnvironment === 'storeClient';

let notificationsModulePromise: Promise<NotificationsModule> | null = null;

const loadNotificationsModule = async () => {
  if (isExpoGo) {
    throw new Error('Notification scheduling requires a development build, not Expo Go.');
  }

  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications').then((module) => {
      module.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });

      return module;
    });
  }

  return notificationsModulePromise;
};

const WEEKDAY_TO_NOTIFICATION_WEEKDAY: Record<string, number> = {
  Sun: 1,
  Mon: 2,
  Tue: 3,
  Wed: 4,
  Thu: 5,
  Fri: 6,
  Sat: 7,
};

const parseTime = (timeValue: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(timeValue);
  const fallback = { hour: 20, minute: 0 };

  if (!match) {
    return fallback;
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  };
};

const expandReminderDays = (days: string[]) => {
  if (days.includes('Everyday')) {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  }

  if (days.includes('Weekdays')) {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  }

  if (days.includes('Weekends')) {
    return ['Sat', 'Sun'];
  }

  return days;
};

const buildTriggerForDay = (
  day: string,
  timeValue: string,
  Notifications: NotificationsModule
): NotificationsModule['SchedulableTriggerInputTypes'] extends never ? never : import('expo-notifications').NotificationTriggerInput => {
  const { hour, minute } = parseTime(timeValue);

  if (day === 'Everyday') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour,
      minute,
      repeats: true,
    };
  }

  const weekday = WEEKDAY_TO_NOTIFICATION_WEEKDAY[day];
  if (!weekday) {
    return {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour,
      minute,
      repeats: true,
    };
  }

  return {
    type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
    weekday,
    hour,
    minute,
    repeats: true,
  };
};

export const ensureNotificationPermissions = async () => {
  const Notifications = await loadNotificationsModule();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
};

export const configureMedicationNotificationChannel = async () => {
  const Notifications = await loadNotificationsModule();

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('medication-reminders', {
      name: 'Medication reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
      sound: 'default',
    });
  }
};

export const scheduleMedicationNotifications = async (params: {
  reminderId: string;
  medicineName: string;
  reminderTime: string;
  days: string[];
}) => {
  if (isExpoGo) {
    throw new Error('Notification scheduling requires a development build on Android (Expo Go does not support this).');
  }

  const Notifications = await loadNotificationsModule();

  const granted = await ensureNotificationPermissions();
  if (!granted) {
    throw new Error('Notification permission denied');
  }

  await configureMedicationNotificationChannel();

  const expandedDays = expandReminderDays(params.days);
  const notificationIds: string[] = [];

  for (const day of expandedDays) {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Medication reminder',
        body: `${params.medicineName} at ${params.reminderTime}`,
        sound: 'default',
        data: {
          reminderId: params.reminderId,
          medicineName: params.medicineName,
          reminderTime: params.reminderTime,
          day,
        },
      },
      trigger: buildTriggerForDay(day, params.reminderTime, Notifications),
    });

    notificationIds.push(notificationId);
  }

  return notificationIds;
};

export const cancelMedicationNotifications = async (notificationIds?: string[]) => {
  if (!notificationIds?.length) {
    return;
  }

  const Notifications = await loadNotificationsModule();

  await Promise.all(
    notificationIds.map((notificationId) => Notifications.cancelScheduledNotificationAsync(notificationId))
  );
};

export const getSupportedReminderDayOptions = () => ['Everyday', 'Weekdays', 'Weekends', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const getNotificationSchedulingWarning = (error: unknown) => {
  const fallback = 'Reminder saved, but notifications are not scheduled on this device.';

  if (!error) {
    return fallback;
  }

  const message = typeof error === 'string' ? error : (error as { message?: string })?.message;
  if (!message) {
    return fallback;
  }

  if (message.toLowerCase().includes('development build')) {
    return 'Reminder saved, but notification alarms require a development build (not Expo Go).';
  }

  if (message.toLowerCase().includes('permission')) {
    return 'Reminder saved, but notification permission is not granted.';
  }

  return fallback;
};
