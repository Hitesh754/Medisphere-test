import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import {
  Bell,
  Plus,
  Clock,
  TrendingUp,
  ClipboardList,
  FileText,
  AlarmClock,
  Pencil,
  Trash2,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { auth } from '@/utils/firebase';
import {
  getUserProfile,
  listUserFiles,
  listUserMedicationReminders,
  updateMedicationReminder,
  deleteMedicationReminder,
  type MedicationReminder,
  type UploadedFile,
} from '@/utils/firebaseData';
import {
  cancelMedicationNotifications,
  scheduleMedicationNotifications,
  getSupportedReminderDayOptions,
  getNotificationSchedulingWarning,
} from '@/utils/medicationNotifications';

const DAY_OPTIONS = getSupportedReminderDayOptions();

const formatTime = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const parseTime = (timeValue: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(timeValue);
  const date = new Date();

  if (!match) {
    date.setHours(20, 0, 0, 0);
    return date;
  }

  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date;
};

const reminderDaysLabel = (days: string[]) => {
  if (days.includes('Everyday')) {
    return 'Everyday';
  }
  if (days.includes('Weekdays')) {
    return 'Weekdays';
  }
  if (days.includes('Weekends')) {
    return 'Weekends';
  }
  return days.join(', ');
};

const isPresetDaySelection = (days: string[]) =>
  days.length === 1 && ['Everyday', 'Weekdays', 'Weekends'].includes(days[0]);

export default function HomeScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('User');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [reminders, setReminders] = useState<MedicationReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorVisible, setEditorVisible] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<MedicationReminder | null>(null);
  const [reminderTime, setReminderTime] = useState(new Date());
  const [selectedDays, setSelectedDays] = useState<string[]>(['Everyday']);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [savingReminder, setSavingReminder] = useState(false);
  const [deletingReminder, setDeletingReminder] = useState(false);

  const loadHome = useCallback(async () => {
    const user = auth.currentUser;

    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const profile = await getUserProfile(user.uid);
      const files = await listUserFiles(user.uid);
      const medicationReminders = await listUserMedicationReminders(user.uid);

      const nameFromProfile = profile?.firstName?.trim();
      setDisplayName(nameFromProfile || user.displayName?.split(' ')?.[0] || user.email || 'User');
      setUploadedFiles(files);
      setReminders(medicationReminders);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHome();
    }, [loadHome])
  );

  if (!auth.currentUser) {
    return <Redirect href="/(auth)/login" />;
  }

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  const latestAnalyzedFile = uploadedFiles.find((file) => Boolean(file.analysisSummary));
  const insightStatement = latestAnalyzedFile?.analysisSummary?.trim() || '';
  const isConcerningInsight = latestAnalyzedFile?.insightSeverity === 'negative';

  const openReminderEditor = (reminder: MedicationReminder) => {
    setSelectedReminder(reminder);
    setReminderTime(parseTime(reminder.reminderTime));
    setSelectedDays(reminder.days?.length ? reminder.days : ['Everyday']);
    setShowTimePicker(false);
    setEditorVisible(true);
  };

  const closeReminderEditor = () => {
    setEditorVisible(false);
    setSelectedReminder(null);
    setShowTimePicker(false);
    setSavingReminder(false);
    setDeletingReminder(false);
  };

  const saveReminder = async () => {
    const user = auth.currentUser;
    if (!user || !selectedReminder) {
      return;
    }

    if (selectedDays.length === 0) {
      Alert.alert('Select days', 'Choose at least one repeat day.');
      return;
    }

    setSavingReminder(true);
    try {
      const days = selectedDays;
      const reminderTimeValue = formatTime(reminderTime);

      let notificationIds: string[] = [];
      let scheduleWarning = '';
      try {
        notificationIds = await scheduleMedicationNotifications({
          reminderId: selectedReminder.id,
          medicineName: selectedReminder.medicineName,
          reminderTime: reminderTimeValue,
          days,
        });
        await cancelMedicationNotifications(selectedReminder.notificationIds);
      } catch (scheduleError) {
        scheduleWarning = getNotificationSchedulingWarning(scheduleError);
      }

      await updateMedicationReminder(user.uid, selectedReminder.id, {
        reminderTime: reminderTimeValue,
        days,
        notificationIds,
      });

      setReminders((previous) =>
        previous.map((item) =>
          item.id === selectedReminder.id
            ? { ...item, reminderTime: reminderTimeValue, days, notificationIds }
            : item
        )
      );
      closeReminderEditor();
      Alert.alert(
        scheduleWarning ? 'Reminder updated with warning' : 'Reminder updated',
        scheduleWarning || `${selectedReminder.medicineName} will remind you at ${reminderTimeValue}.`
      );
    } catch (error: any) {
      Alert.alert('Update failed', error?.message || 'Could not update reminder.');
      setSavingReminder(false);
    }
  };

  const deleteReminder = async () => {
    const user = auth.currentUser;
    if (!user || !selectedReminder) {
      return;
    }

    Alert.alert('Delete reminder', 'Remove this alarm from Home?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingReminder(true);
          try {
            await cancelMedicationNotifications(selectedReminder.notificationIds);
            await deleteMedicationReminder(user.uid, selectedReminder.id);
            setReminders((previous) => previous.filter((item) => item.id !== selectedReminder.id));
            closeReminderEditor();
            Alert.alert('Reminder deleted', 'The medication alarm was removed.');
          } catch (error: any) {
            Alert.alert('Delete failed', error?.message || 'Could not delete reminder.');
            setDeletingReminder(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning, {displayName}</Text>
            <Text style={styles.subtitle}>How are you feeling today?</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Bell size={24} color="#475569" />
          </TouchableOpacity>
        </View>

        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/(tabs)/prescriptions')}>
              <View style={[styles.actionIconContainer, styles.scanIconContainer]}>
                <ClipboardList size={24} color="#2563EB" />
              </View>
              <Text style={styles.actionText}>Scan Prescription</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(tabs)/medilens')}>
              <View style={styles.actionIconContainer}>
                <Plus size={24} color="#10B981" />
              </View>
              <Text style={styles.actionText}>Upload Lab Report</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Medication Reminders</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/prescriptions')}>
              <Text style={styles.viewAll}>Set Alarm</Text>
            </TouchableOpacity>
          </View>

          {reminders.length > 0 ? (
            reminders.map((reminder) => (
              <TouchableOpacity key={reminder.id} style={styles.reminderCard} onPress={() => openReminderEditor(reminder)}>
                <View style={styles.reminderIcon}>
                  <AlarmClock size={20} color="#2563EB" />
                </View>
                <View style={styles.reminderInfo}>
                  <Text style={styles.reminderName}>{reminder.medicineName}</Text>
                  <Text style={styles.reminderMeta}>
                    {reminder.reminderTime} • {reminderDaysLabel(reminder.days || [])}
                  </Text>
                  <Text style={styles.reminderSubMeta} numberOfLines={1}>
                    {reminder.mealTiming || reminder.frequency || 'Medication reminder'}
                  </Text>
                </View>
                <View style={styles.reminderBadgeWrap}>
                  <View style={[styles.reminderBadge, reminder.autoScheduled ? styles.autoBadge : styles.manualBadge]}>
                    <Text style={styles.reminderBadgeText}>{reminder.autoScheduled ? 'Auto' : 'Manual'}</Text>
                  </View>
                  <View style={styles.reminderActionsRow}>
                    <TouchableOpacity style={styles.smallActionButton} onPress={() => openReminderEditor(reminder)}>
                      <Pencil size={14} color="#2563EB" />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyReminderCard}>
              <View style={styles.emptyReminderIcon}>
                <AlarmClock size={22} color="#2563EB" />
              </View>
              <Text style={styles.emptyReminderTitle}>No medication alarms set</Text>
              <Text style={styles.emptyReminderText}>
                Scan a prescription to auto-create reminders for before or after dinner medicines, or set one manually with a repeat day.
              </Text>
              <TouchableOpacity style={styles.emptyReminderButton} onPress={() => router.push('/(tabs)/prescriptions')}>
                <Text style={styles.emptyReminderButtonText}>Set Medication Alarm</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {uploadedFiles.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Uploads</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/medilocker')}>
                <Text style={styles.viewAll}>View All</Text>
              </TouchableOpacity>
            </View>
            {uploadedFiles.slice(0, 3).map((file) => (
              <View key={file.id} style={styles.uploadCard}>
                <View style={styles.uploadIcon}>
                  <FileText size={18} color="#2563EB" />
                </View>
                <View style={styles.uploadInfo}>
                  <Text style={styles.uploadTitle}>{file.title}</Text>
                  <Text style={styles.uploadMeta}>{file.fileSizeLabel}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Health Insights</Text>
            <TouchableOpacity>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          {insightStatement ? (
            <View style={styles.insightCard}>
              <View style={styles.insightIconContainer}>
                <TrendingUp size={20} color={isConcerningInsight ? '#DC2626' : '#10B981'} />
              </View>
              <View style={styles.insightContent}>
                <Text style={styles.insightDescription}>{insightStatement}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyInsightCard}>
              <Text style={styles.emptyInsightTitle}>No scanned report yet</Text>
              <Text style={styles.emptyInsightText}>
                Upload a report in MediLens and the latest analysis will show here.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal transparent visible={editorVisible} animationType="slide" onRequestClose={closeReminderEditor}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selectedReminder?.medicineName || 'Medication'}</Text>
                <Text style={styles.modalSubtitle}>Edit reminder or remove it from Home</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={closeReminderEditor}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.timeSelectButton} onPress={() => setShowTimePicker((previous) => !previous)}>
              <Text style={styles.timeSelectLabel}>Reminder time</Text>
              <Text style={styles.timeSelectValue}>{formatTime(reminderTime)}</Text>
            </TouchableOpacity>

            {showTimePicker ? (
              <DateTimePicker
                value={reminderTime}
                mode="time"
                is24Hour
                display="default"
                onChange={(_event, selectedDate) => {
                  if (selectedDate) {
                    setReminderTime(selectedDate);
                  }
                  setShowTimePicker(false);
                }}
              />
            ) : null}

            <Text style={styles.daysLabel}>Repeat schedule</Text>
            <View style={styles.daysWrap}>
              {DAY_OPTIONS.map((day) => {
                const active = selectedDays.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayChip, active ? styles.dayChipActive : null]}
                    onPress={() => {
                      if (isPresetDaySelection([day])) {
                        setSelectedDays([day]);
                        return;
                      }

                      setSelectedDays((previous) => {
                        const withoutPreset = previous.filter(
                          (item) => item !== 'Everyday' && item !== 'Weekdays' && item !== 'Weekends'
                        );
                        if (withoutPreset.includes(day)) {
                          const next = withoutPreset.filter((item) => item !== day);
                          return next.length > 0 ? next : ['Everyday'];
                        }
                        return [...withoutPreset, day];
                      });
                    }}>
                    <Text style={[styles.dayChipText, active ? styles.dayChipTextActive : null]}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton, deletingReminder ? styles.disabledButton : null]}
                onPress={deleteReminder}
                disabled={deletingReminder}>
                {deletingReminder ? <ActivityIndicator color="#FFFFFF" /> : <>
                  <Trash2 size={16} color="#FFFFFF" />
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={closeReminderEditor}
                disabled={savingReminder || deletingReminder}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, savingReminder ? styles.disabledButton : null]}
                onPress={saveReminder}
                disabled={savingReminder || deletingReminder}>
                {savingReminder ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionsContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  scanIconContainer: {
    backgroundColor: '#EFF6FF',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAll: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  reminderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reminderInfo: {
    flex: 1,
  },
  reminderName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  reminderMeta: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  reminderSubMeta: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  reminderBadgeWrap: {
    alignItems: 'flex-end',
    gap: 8,
  },
  reminderActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  smallActionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  autoBadge: {
    backgroundColor: '#ECFDF5',
  },
  manualBadge: {
    backgroundColor: '#EFF6FF',
  },
  reminderBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  emptyReminderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyReminderIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyReminderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyReminderText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 14,
  },
  emptyReminderButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  emptyReminderButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  uploadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  uploadIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  uploadInfo: {
    flex: 1,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  uploadMeta: {
    fontSize: 12,
    marginTop: 2,
    color: '#64748B',
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  insightIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  insightContent: {
    flex: 1,
  },
  insightDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
  },
  emptyInsightCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  emptyInsightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  emptyInsightText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 14,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  closeButton: {
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeButtonText: {
    color: '#1E293B',
    fontWeight: '700',
    fontSize: 12,
  },
  timeSelectButton: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#F8FAFC',
  },
  timeSelectLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  timeSelectValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  daysLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  daysWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  dayChipActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  dayChipTextActive: {
    color: '#2563EB',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
  },
  cancelButtonText: {
    color: '#1E293B',
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: '#2563EB',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: '#DC2626',
    flex: 1.1,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.65,
  },
});
