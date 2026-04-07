import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ClipboardList } from 'lucide-react-native';
import { markSignupCompleted } from '@/constants/signupFlow';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '@/utils/firebase';
import { saveUserProfile } from '@/utils/firebaseData';

const GENDERS = ['Male', 'Female', 'Other'];

const formatTime = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const parseTimeToDate = (timeValue: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(timeValue);
  const date = new Date();

  if (!match) {
    date.setHours(12, 0, 0, 0);
    return date;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

export default function SignupPersonalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    phone?: string;
  }>();

  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [lunchTime, setLunchTime] = useState('');
  const [dinnerTime, setDinnerTime] = useState('');
  const [pickerField, setPickerField] = useState<'lunch' | 'dinner' | null>(null);
  const [pickerDate, setPickerDate] = useState(new Date());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const openTimePicker = (field: 'lunch' | 'dinner') => {
    setPickerField(field);
    setPickerDate(parseTimeToDate(field === 'lunch' ? lunchTime : dinnerTime));
  };

  const handleTimePicked = (_event: any, selectedDate?: Date) => {
    setPickerField(null);

    if (!selectedDate || !pickerField) {
      return;
    }

    const value = formatTime(selectedDate);
    if (pickerField === 'lunch') {
      setLunchTime(value);
      if (errors.lunchTime) {
        setErrors((previous) => {
          const next = { ...previous };
          delete next.lunchTime;
          return next;
        });
      }
      return;
    }

    setDinnerTime(value);
    if (errors.dinnerTime) {
      setErrors((previous) => {
        const next = { ...previous };
        delete next.dinnerTime;
        return next;
      });
    }
  };

  const validateStepTwo = () => {
    const nextErrors: Record<string, string> = {};

    if (!gender) {
      nextErrors.gender = 'Please select gender';
    }
    if (!weight || Number(weight) <= 0) {
      nextErrors.weight = 'Enter valid weight in kg';
    }
    if (!height || Number(height) <= 0) {
      nextErrors.height = 'Enter valid height in cm';
    }
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(lunchTime.trim())) {
      nextErrors.lunchTime = 'Use HH:MM format (24-hour)';
    }
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(dinnerTime.trim())) {
      nextErrors.dinnerTime = 'Use HH:MM format (24-hour)';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleFinish = async () => {
    if (!validateStepTwo()) {
      return;
    }

    if (!params.email || !params.password || !params.firstName || !params.lastName) {
      Alert.alert('Missing details', 'Please complete signup details again.');
      return;
    }

    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        params.email,
        params.password
      );

      const fullName = `${params.firstName} ${params.lastName}`.trim();
      await updateProfile(credential.user, { displayName: fullName });

      await saveUserProfile({
        uid: credential.user.uid,
        firstName: params.firstName,
        lastName: params.lastName,
        email: params.email,
        phone: params.phone,
        gender,
        weight,
        height,
        lunchTime: lunchTime.trim(),
        dinnerTime: dinnerTime.trim(),
      });

      markSignupCompleted();
      Alert.alert('Signup complete', 'Your account and profile are ready.');
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Signup failed', error?.message || 'Could not create account.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={20} color="#334155" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <ClipboardList size={24} color="#2563EB" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Personal Info</Text>
            <Text style={styles.headerSubtitle}>Step 2 of 2 • Final details</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.formCard}>
          <Text style={styles.welcomeText}>
            {params.firstName ? `Hi ${params.firstName},` : 'Almost done,'} complete
            your profile.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderRow}>
              {GENDERS.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.genderChip,
                    gender === item ? styles.genderChipActive : null,
                  ]}
                  onPress={() => setGender(item)}>
                  <Text
                    style={[
                      styles.genderChipText,
                      gender === item ? styles.genderChipTextActive : null,
                    ]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.gender ? <Text style={styles.errorText}>{errors.gender}</Text> : null}
          </View>

          <View style={styles.rowInputs}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput
                placeholder="e.g. 70"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
                value={weight}
                onChangeText={setWeight}
                style={[styles.input, errors.weight ? styles.inputError : null]}
              />
              {errors.weight ? <Text style={styles.errorText}>{errors.weight}</Text> : null}
            </View>

            <View style={styles.halfWidth}>
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput
                placeholder="e.g. 170"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
                value={height}
                onChangeText={setHeight}
                style={[styles.input, errors.height ? styles.inputError : null]}
              />
              {errors.height ? <Text style={styles.errorText}>{errors.height}</Text> : null}
            </View>
          </View>

          <View style={styles.rowInputs}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Lunch Time (HH:MM)</Text>
              <TouchableOpacity
                style={[styles.timeButton, errors.lunchTime ? styles.inputError : null]}
                onPress={() => openTimePicker('lunch')}>
                <Text style={lunchTime ? styles.timeValueText : styles.timePlaceholderText}>
                  {lunchTime || 'Select lunch time'}
                </Text>
              </TouchableOpacity>
              {errors.lunchTime ? <Text style={styles.errorText}>{errors.lunchTime}</Text> : null}
            </View>

            <View style={styles.halfWidth}>
              <Text style={styles.label}>Dinner Time (HH:MM)</Text>
              <TouchableOpacity
                style={[styles.timeButton, errors.dinnerTime ? styles.inputError : null]}
                onPress={() => openTimePicker('dinner')}>
                <Text style={dinnerTime ? styles.timeValueText : styles.timePlaceholderText}>
                  {dinnerTime || 'Select dinner time'}
                </Text>
              </TouchableOpacity>
              {errors.dinnerTime ? <Text style={styles.errorText}>{errors.dinnerTime}</Text> : null}
            </View>
          </View>

          {pickerField ? (
            <DateTimePicker
              value={pickerDate}
              mode="time"
              is24Hour
              display="default"
              onChange={handleTimePicked}
            />
          ) : null}

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Step 1 Summary</Text>
            <Text style={styles.summaryText}>
              Name: {params.firstName ?? '-'} {params.lastName ?? ''}
            </Text>
            <Text style={styles.summaryText}>Email: {params.email ?? '-'}</Text>
            <Text style={styles.summaryText}>Phone: {params.phone ?? '-'}</Text>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleFinish}>
            <Text style={styles.primaryButtonText}>Finish Signup</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  welcomeText: {
    fontSize: 16,
    color: '#334155',
    marginBottom: 18,
    lineHeight: 22,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  timeButton: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  timeValueText: {
    fontSize: 16,
    color: '#0F172A',
  },
  timePlaceholderText: {
    fontSize: 16,
    color: '#94A3B8',
  },
  inputError: {
    borderColor: '#DC2626',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#DC2626',
    marginTop: 6,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
  },
  genderChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  genderChipActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  genderChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  genderChipTextActive: {
    color: '#2563EB',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  halfWidth: {
    flex: 1,
  },
  summaryCard: {
    marginTop: 12,
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 2,
  },
  summaryText: {
    fontSize: 13,
    color: '#475569',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});