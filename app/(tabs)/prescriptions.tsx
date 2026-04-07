import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Pill, Camera, Image as ImageIcon, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import { supabase } from '@/components/integrations/supabase/client';
import { auth } from '@/utils/firebase';
import {
  createMedicationReminder,
  getUserProfile,
  listUserMedicationReminders,
  updateMedicationReminder,
  type MedicationReminder,
} from '@/utils/firebaseData';
import {
  scheduleMedicationNotifications,
  getSupportedReminderDayOptions,
  getNotificationSchedulingWarning,
} from '@/utils/medicationNotifications';

interface MedicineResult {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  advisory: string;
  mealTiming?: string;
}

interface ScanResponse {
  medicines: MedicineResult[];
  generalAdvice: string;
  error?: string;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
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

const shiftTime = (timeValue: string, minutesDelta: number) => {
  const nextDate = parseTime(timeValue);
  nextDate.setMinutes(nextDate.getMinutes() + minutesDelta);
  return formatTime(nextDate);
};

const normalizeMealTiming = (value?: string) => (value || '').trim().toLowerCase();

const isDinnerTiming = (value?: string) => {
  const timing = normalizeMealTiming(value);
  return timing === 'before dinner' || timing === 'after dinner';
};

const isFrequencyUnclear = (value?: string) => {
  const timing = (value || '').trim().toLowerCase();
  return !timing || /\b(as directed|if needed|prn|unknown|unclear|not sure|follow doctor|when required)\b/.test(timing);
};

const reminderKey = (medicineName: string, reminderTime: string, days: string[]) =>
  `${medicineName.trim().toLowerCase()}|${reminderTime}|${days.map((day) => day.toLowerCase()).sort().join(',')}`;

const reminderDaysLabel = (days: string[]) => (days.includes('Everyday') ? 'Everyday' : days.join(', '));

const normalizeReminderDays = (days: string[]) => {
  if (days.includes('Everyday')) {
    return ['Everyday'];
  }

  if (days.includes('Weekdays')) {
    return ['Weekdays'];
  }

  if (days.includes('Weekends')) {
    return ['Weekends'];
  }

  return days;
};

export default function PrescriptionsPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScanResponse | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [autoReminderNote, setAutoReminderNote] = useState('');
  const [savedReminderKeys, setSavedReminderKeys] = useState<string[]>([]);
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [reminderMedicine, setReminderMedicine] = useState<MedicineResult | null>(null);
  const [reminderTime, setReminderTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>(['Everyday']);
  const [savingReminder, setSavingReminder] = useState(false);

  const reminderKeySet = useMemo(() => new Set(savedReminderKeys), [savedReminderKeys]);

  const openManualReminder = (medicine: MedicineResult) => {
    const mealTiming = normalizeMealTiming(medicine.mealTiming);
    const suggestedTime = isDinnerTiming(mealTiming)
      ? mealTiming === 'after dinner'
        ? shiftTime('20:00', 30)
        : shiftTime('20:00', -30)
      : '08:00';

    setReminderMedicine(medicine);
    setReminderTime(parseTime(suggestedTime));
    setSelectedDays(['Everyday']);
    setShowTimePicker(false);
    setReminderModalVisible(true);
  };

  const saveManualReminder = async () => {
    const user = auth.currentUser;
    if (!user || !reminderMedicine) {
      Alert.alert('Login required', 'Please login to save medication reminders.');
      return;
    }

    if (selectedDays.length === 0) {
      Alert.alert('Select a day', 'Choose at least one day for the alarm.');
      return;
    }

    const days = selectedDays.includes('Everyday') ? ['Everyday'] : selectedDays;
    const reminderTimeValue = formatTime(reminderTime);
    const key = reminderKey(reminderMedicine.name, reminderTimeValue, days);

    setSavingReminder(true);
    try {
      if (!reminderKeySet.has(key)) {
        const reminderId = await createMedicationReminder({
          userId: user.uid,
          medicineName: reminderMedicine.name,
          dosage: reminderMedicine.dosage,
          frequency: reminderMedicine.frequency,
          mealTiming: reminderMedicine.mealTiming,
          reminderTime: reminderTimeValue,
          days,
          autoScheduled: false,
          source: 'manual-from-prescription',
        });

        let notificationIds: string[] = [];
        let scheduleWarning = '';
        try {
          notificationIds = await scheduleMedicationNotifications({
            reminderId,
            medicineName: reminderMedicine.name,
            reminderTime: reminderTimeValue,
            days,
          });
        } catch (scheduleError) {
          scheduleWarning = getNotificationSchedulingWarning(scheduleError);
        }

        await updateMedicationReminder(user.uid, reminderId, { notificationIds });
        setSavedReminderKeys((previous) => [...previous, key]);

        setReminderModalVisible(false);
        setReminderMedicine(null);
        Alert.alert(
          scheduleWarning ? 'Alarm saved with warning' : 'Alarm saved',
          scheduleWarning || `${reminderMedicine.name} will remind you on ${reminderDaysLabel(days)} at ${reminderTimeValue}.`
        );
        return;
      }

      setReminderModalVisible(false);
      setReminderMedicine(null);
      Alert.alert('Alarm saved', `${reminderMedicine.name} will remind you on ${reminderDaysLabel(days)} at ${reminderTimeValue}.`);
    } catch (error: any) {
      Alert.alert('Could not save alarm', error?.message || 'Please try again.');
    } finally {
      setSavingReminder(false);
    }
  };

  const handleImage = async (uri: string, base64: string, mimeType: string) => {
    setPreviewUrl(uri);
    setLoading(true);
    setResults(null);
    setAutoReminderNote('');
    try {
      const { data, error } = await supabase.functions.invoke('scan-prescription', {
        body: { imageBase64: base64, mimeType },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setResults(data as ScanResponse);
      Alert.alert('Success', `Found ${data.medicines?.length || 0} medicine(s)!`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to scan prescription.');
    } finally {
      setLoading(false);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      await handleImage(asset.uri, asset.base64!, asset.mimeType || 'image/jpeg');
    }
  };

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Camera permission is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      await handleImage(asset.uri, asset.base64!, asset.mimeType || 'image/jpeg');
    }
  };

  useEffect(() => {
    const autoSchedule = async () => {
      if (!results?.medicines?.length) {
        return;
      }

      const user = auth.currentUser;
      if (!user) {
        return;
      }

      try {
        const profile = await getUserProfile(user.uid);
        const existingReminders = await listUserMedicationReminders(user.uid);
        const existingKeys = new Set(
          existingReminders.map((reminder: MedicationReminder) =>
            reminderKey(reminder.medicineName, reminder.reminderTime, reminder.days || [])
          )
        );

        const createdLabels: string[] = [];
        const dinnerTime = profile?.dinnerTime || '20:00';

        for (const medicine of results.medicines) {
          const mealTiming = normalizeMealTiming(medicine.mealTiming || medicine.advisory || medicine.frequency);
          if (!isDinnerTiming(mealTiming)) {
            continue;
          }

          const reminderTimeValue =
            mealTiming === 'after dinner' ? shiftTime(dinnerTime, 30) : shiftTime(dinnerTime, -30);
          const days = ['Everyday'];
          const key = reminderKey(medicine.name, reminderTimeValue, days);

          if (existingKeys.has(key)) {
            continue;
          }

          const reminderId = await createMedicationReminder({
            userId: user.uid,
            medicineName: medicine.name,
            dosage: medicine.dosage,
            frequency: medicine.frequency,
            mealTiming: medicine.mealTiming,
            reminderTime: reminderTimeValue,
            days,
            autoScheduled: true,
            source: 'prescription-analysis',
          });

          let notificationIds: string[] = [];
          try {
            notificationIds = await scheduleMedicationNotifications({
              reminderId,
              medicineName: medicine.name,
              reminderTime: reminderTimeValue,
              days,
            });
          } catch {
            notificationIds = [];
          }

          await updateMedicationReminder(user.uid, reminderId, { notificationIds });
          existingKeys.add(key);
          createdLabels.push(`${medicine.name} at ${reminderTimeValue}`);
          setSavedReminderKeys((previous) => [...previous, key]);
        }

        if (createdLabels.length > 0) {
          setAutoReminderNote(`Auto reminders saved for ${createdLabels.join(', ')}.`);
        } else {
          setAutoReminderNote('');
        }
      } catch {
        setAutoReminderNote('');
      }
    };

    void autoSchedule();
  }, [results]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Scan Prescription</Text>
      <Text style={styles.subtitle}>Upload or capture a prescription to extract medicine details</Text>

      {!previewUrl && !loading && (
        <View style={styles.uploadCard}>
          <View style={styles.iconBox}>
            <Pill size={28} color="#fff" />
          </View>
          <Text style={styles.uploadTitle}>Upload Prescription</Text>
          <Text style={styles.uploadSubtitle}>Take a photo or choose from gallery</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.primaryButton} onPress={pickFromCamera}>
              <Camera size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.outlineButton} onPress={pickFromGallery}>
              <ImageIcon size={18} color="#2563EB" />
              <Text style={styles.outlineButtonText}>Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {previewUrl && (
        <View style={styles.previewCard}>
          <View style={styles.previewTopBar}>
            <Text style={styles.previewLabel}>Selected Prescription</Text>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => {
                setResults(null);
                setPreviewUrl(null);
                setAutoReminderNote('');
              }}>
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.previewImageWrap}>
            <ImageIcon size={28} color="#2563EB" />
            <Text style={styles.previewText}>Prescription image ready for analysis</Text>
          </View>
          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#2563EB" />
              <Text style={styles.loadingText}>Analyzing with AI...</Text>
            </View>
          )}
        </View>
      )}

      {autoReminderNote ? (
        <View style={styles.autoReminderCard}>
          <CheckCircle2 size={18} color="#16a34a" />
          <Text style={styles.autoReminderText}>{autoReminderNote}</Text>
        </View>
      ) : null}

      {results && results.medicines && results.medicines.length > 0 && (
        <View style={styles.resultsContainer}>
          <View style={styles.foundRow}>
            <CheckCircle2 size={20} color="#16a34a" />
            <Text style={styles.foundText}>{results.medicines.length} Medicine(s) Found</Text>
          </View>

          {results.medicines.map((med, i) => {
            const mealTiming = normalizeMealTiming(med.mealTiming || med.advisory || med.frequency);
            const autoReminderReady = isDinnerTiming(mealTiming);
            const needsManualAlarm = !autoReminderReady || isFrequencyUnclear(med.frequency);
            const currentReminderKey = reminderKey(
              med.name,
              autoReminderReady ? shiftTime('20:00', mealTiming === 'after dinner' ? 30 : -30) : '08:00',
              ['Everyday']
            );
            const hasReminder = savedReminderKeys.includes(currentReminderKey);

            return (
              <View key={i} style={styles.medicineCard}>
                <View style={styles.medHeader}>
                  <View style={styles.medIconBox}>
                    <Pill size={18} color="#fff" />
                  </View>
                  <View style={styles.medHeaderText}>
                    <Text style={styles.medName}>{med.name}</Text>
                    <Text style={styles.medDosage}>{med.dosage}</Text>
                  </View>
                </View>
                <View style={styles.gridRow}>
                  <View style={styles.gridItem}>
                    <View style={styles.gridLabel}>
                      <Clock size={12} color="#64748B" />
                      <Text style={styles.gridLabelText}>FREQUENCY</Text>
                    </View>
                    <Text style={styles.gridValue}>{med.frequency}</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <View style={styles.gridLabel}>
                      <Clock size={12} color="#64748B" />
                      <Text style={styles.gridLabelText}>DURATION</Text>
                    </View>
                    <Text style={styles.gridValue}>{med.duration}</Text>
                  </View>
                </View>
                <View style={styles.timingBox}>
                  <Text style={styles.timingLabel}>Meal timing</Text>
                  <Text style={styles.timingValue}>{med.mealTiming || med.advisory || 'Unknown'}</Text>
                </View>
                <View style={styles.advisoryBox}>
                  <AlertTriangle size={16} color="#d97706" />
                  <Text style={styles.advisoryText}>{med.advisory}</Text>
                </View>
                {needsManualAlarm ? (
                  <View style={styles.manualAlarmNote}>
                    <Clock size={14} color="#2563EB" />
                    <Text style={styles.manualAlarmNoteText}>
                      Alarm timing looks unclear. Set a custom repeat schedule.
                    </Text>
                  </View>
                ) : null}
                <View style={styles.reminderRow}>
                  {hasReminder ? (
                    <View style={styles.reminderBadge}>
                      <CheckCircle2 size={14} color="#16a34a" />
                      <Text style={styles.reminderBadgeText}>Reminder set</Text>
                    </View>
                  ) : autoReminderReady ? (
                    <View style={styles.reminderHint}>
                      <Clock size={14} color="#2563EB" />
                      <Text style={styles.reminderHintText}>Auto reminder will be created</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity style={styles.setAlarmButton} onPress={() => openManualReminder(med)}>
                    <Text style={styles.setAlarmButtonText}>Set Alarm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {results.generalAdvice ? (
            <View style={styles.generalAdvice}>
              <Text style={styles.generalAdviceTitle}>⚕️ General Advisory</Text>
              <Text style={styles.generalAdviceText}>{results.generalAdvice}</Text>
            </View>
          ) : null}
        </View>
      )}

      {results && (!results.medicines || results.medicines.length === 0) && (
        <View style={styles.noResultCard}>
          <AlertTriangle size={32} color="#d97706" />
          <Text style={styles.noResultTitle}>No medicines detected</Text>
          <Text style={styles.noResultText}>{results.generalAdvice || 'Please try a clearer image.'}</Text>
          <TouchableOpacity
            style={styles.outlineButton}
            onPress={() => {
              setResults(null);
              setPreviewUrl(null);
              setAutoReminderNote('');
            }}>
            <Text style={styles.outlineButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal transparent visible={reminderModalVisible} animationType="slide" onRequestClose={() => setReminderModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set Medication Alarm</Text>
            <Text style={styles.modalSubtitle}>{reminderMedicine?.name || 'Medication'}</Text>

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

            <Text style={styles.daysLabel}>Select day(s)</Text>
            <View style={styles.daysWrap}>
              {DAY_OPTIONS.map((day) => {
                const active = selectedDays.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayChip, active ? styles.dayChipActive : null]}
                    onPress={() => {
                      if (day === 'Everyday' || day === 'Weekdays' || day === 'Weekends') {
                        setSelectedDays([day]);
                        return;
                      }

                      setSelectedDays((previous) => {
                        const withoutEveryday = previous.filter(
                          (item) => item !== 'Everyday' && item !== 'Weekdays' && item !== 'Weekends'
                        );
                        if (withoutEveryday.includes(day)) {
                          const next = withoutEveryday.filter((item) => item !== day);
                          return next.length > 0 ? next : ['Everyday'];
                        }
                        return [...withoutEveryday, day];
                      });
                    }}>
                    <Text style={[styles.dayChipText, active ? styles.dayChipTextActive : null]}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setReminderModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, savingReminder ? styles.disabledButton : null]}
                onPress={saveManualReminder}
                disabled={savingReminder}>
                {savingReminder ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Alarm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 20 },
  uploadCard: { backgroundColor: '#fff', borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 2, borderColor: '#DBEAFE', borderStyle: 'dashed' },
  iconBox: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  uploadTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  uploadSubtitle: { fontSize: 14, color: '#64748B', marginBottom: 16 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2563EB', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  outlineButton: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#2563EB', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  outlineButtonText: { color: '#2563EB', fontWeight: '600' },
  previewCard: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', marginBottom: 16, padding: 16, gap: 12 },
  previewTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewLabel: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  resetButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#EFF6FF' },
  resetButtonText: { color: '#2563EB', fontWeight: '700', fontSize: 12 },
  previewImageWrap: { minHeight: 180, borderRadius: 16, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  previewText: { color: '#1E293B', fontWeight: '600', textAlign: 'center' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  loadingText: { color: '#2563EB', fontWeight: '600' },
  autoReminderCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 14, padding: 14, marginBottom: 12 },
  autoReminderText: { color: '#166534', fontSize: 13, fontWeight: '600', flex: 1 },
  resultsContainer: { gap: 12 },
  foundRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  foundText: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  medicineCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12 },
  medHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  medHeaderText: { flex: 1 },
  medIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  medName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  medDosage: { fontSize: 14, color: '#2563EB', fontWeight: '600' },
  gridRow: { flexDirection: 'row', gap: 8 },
  gridItem: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 10, padding: 10 },
  gridLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  gridLabelText: { fontSize: 10, color: '#64748B', fontWeight: '600' },
  gridValue: { fontSize: 12, fontWeight: '600', color: '#1E293B' },
  timingBox: { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12 },
  timingLabel: { fontSize: 11, color: '#2563EB', fontWeight: '700', marginBottom: 2 },
  timingValue: { fontSize: 13, color: '#1E293B', fontWeight: '600' },
  advisoryBox: { flexDirection: 'row', gap: 8, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 10, padding: 12 },
  advisoryText: { fontSize: 12, color: '#1E293B', flex: 1 },
  manualAlarmNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12 },
  manualAlarmNoteText: { flex: 1, fontSize: 12, color: '#1E293B', lineHeight: 18, fontWeight: '600' },
  reminderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  reminderBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999 },
  reminderBadgeText: { color: '#166534', fontSize: 12, fontWeight: '700' },
  reminderHint: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, flex: 1 },
  reminderHintText: { color: '#2563EB', fontSize: 12, fontWeight: '700' },
  setAlarmButton: { backgroundColor: '#2563EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  setAlarmButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  generalAdvice: { backgroundColor: '#EFF6FF', borderRadius: 16, padding: 16 },
  generalAdviceTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  generalAdviceText: { fontSize: 12, color: '#1E293B' },
  noResultCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', gap: 8 },
  noResultTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  noResultText: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  modalSubtitle: { fontSize: 14, color: '#64748B' },
  timeSelectButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 14, padding: 14, backgroundColor: '#F8FAFC' },
  timeSelectLabel: { fontSize: 12, color: '#64748B', marginBottom: 4 },
  timeSelectValue: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  daysLabel: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  daysWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#FFFFFF' },
  dayChipActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  dayChipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  dayChipTextActive: { color: '#2563EB' },
  modalButtonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalButton: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  cancelButton: { backgroundColor: '#F1F5F9' },
  cancelButtonText: { color: '#1E293B', fontWeight: '700' },
  saveButton: { backgroundColor: '#2563EB' },
  saveButtonText: { color: '#FFFFFF', fontWeight: '700' },
  disabledButton: { opacity: 0.65 },
});
