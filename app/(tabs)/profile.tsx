import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogOut, UserRound, FileText, HeartPulse, Pencil } from 'lucide-react-native';
import { signOut } from 'firebase/auth';
import { auth } from '@/utils/firebase';
import { getUserProfile, listUserFiles, saveUserProfile, type UploadedFile } from '@/utils/firebaseData';

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

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [profileName, setProfileName] = useState('User');
  const [email, setEmail] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [lunchTime, setLunchTime] = useState('');
  const [dinnerTime, setDinnerTime] = useState('');
  const [pickerField, setPickerField] = useState<'lunch' | 'dinner' | null>(null);
  const [pickerDate, setPickerDate] = useState(new Date());

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      const user = auth.currentUser;
      if (!user) {
        if (mounted) {
          setLoading(false);
        }
        return;
      }

      try {
        const profile = await getUserProfile(user.uid);
        const userFiles = await listUserFiles(user.uid);

        if (!mounted) {
          return;
        }

        setProfileName(profile?.firstName?.trim() || user.displayName?.split(' ')?.[0] || 'User');
        setEmail(profile?.email || user.email || '-');
        setFiles(userFiles);
        setFirstName(profile?.firstName || user.displayName?.split(' ')?.[0] || '');
        setLastName(profile?.lastName || user.displayName?.split(' ')?.slice(1).join(' ') || '');
        setPhone(profile?.phone || '');
        setGender(profile?.gender || '');
        setWeight(profile?.weight || '');
        setHeight(profile?.height || '');
        setLunchTime(profile?.lunchTime || '');
        setDinnerTime(profile?.dinnerTime || '');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  const summary = useMemo(() => {
    const analyzed = files.filter((file) => Boolean(file.analysisSummary));
    const concerning = analyzed.filter((file) => file.insightSeverity === 'negative');
    const latest = analyzed[0];

    return {
      totalFiles: files.length,
      analyzedFiles: analyzed.length,
      concerningCount: concerning.length,
      latestInsight: latest?.analysisSummary || 'No analyzed report yet.',
    };
  }, [files]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/(auth)/login');
    } catch (error: any) {
      Alert.alert('Logout failed', error?.message || 'Please try again.');
    }
  };

  const handleSaveProfile = async () => {
    const user = auth.currentUser;
    if (!user) {
      return;
    }

    if (!firstName.trim()) {
      Alert.alert('Missing first name', 'First name is required.');
      return;
    }

    if (lunchTime.trim() && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(lunchTime.trim())) {
      Alert.alert('Invalid lunch time', 'Use HH:MM format (24-hour), for example 13:00.');
      return;
    }

    if (dinnerTime.trim() && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(dinnerTime.trim())) {
      Alert.alert('Invalid dinner time', 'Use HH:MM format (24-hour), for example 20:00.');
      return;
    }

    setSaving(true);
    try {
      await saveUserProfile({
        uid: user.uid,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email,
        phone: phone.trim(),
        gender: gender.trim(),
        weight: weight.trim(),
        height: height.trim(),
        lunchTime: lunchTime.trim(),
        dinnerTime: dinnerTime.trim(),
      });

      setProfileName(firstName.trim());
      setIsEditing(false);
      Alert.alert('Profile updated', 'Your profile changes were saved.');
    } catch (error: any) {
      Alert.alert('Update failed', error?.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

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
      return;
    }

    setDinnerTime(value);
  };

  if (!auth.currentUser) {
    return <Redirect href="/(auth)/login" />;
  }

  if (loading) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: '#F8FAFC' }]}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: '#F8FAFC' }]} contentContainerStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={[styles.profileCard, { backgroundColor: '#FFFFFF' }]}>
        <View style={[styles.avatar, { backgroundColor: '#EFF6FF' }]}>
          <UserRound size={28} color="#2563EB" />
        </View>
        <Text style={[styles.name, { color: '#1E293B' }]}>{profileName}</Text>
        <Text style={[styles.email, { color: '#64748B' }]}>{email}</Text>
        <TouchableOpacity style={styles.editProfileButton} onPress={() => setIsEditing((prev) => !prev)}>
          <Pencil size={14} color="#2563EB" />
          <Text style={styles.editProfileButtonText}>{isEditing ? 'Cancel' : 'Edit Profile'}</Text>
        </TouchableOpacity>
      </View>

      {isEditing ? (
        <View style={[styles.summaryCard, { backgroundColor: '#FFFFFF' }]}>
          <Text style={[styles.sectionTitle, { color: '#1E293B' }]}>Edit Profile</Text>

          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>First name</Text>
              <TextInput value={firstName} onChangeText={setFirstName} style={styles.fieldInput} placeholder="First name" placeholderTextColor="#94A3B8" />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>Last name</Text>
              <TextInput value={lastName} onChangeText={setLastName} style={styles.fieldInput} placeholder="Last name" placeholderTextColor="#94A3B8" />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Phone</Text>
          <TextInput value={phone} onChangeText={setPhone} style={styles.fieldInput} placeholder="Phone" placeholderTextColor="#94A3B8" keyboardType="phone-pad" />

          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>Gender</Text>
              <TextInput value={gender} onChangeText={setGender} style={styles.fieldInput} placeholder="Gender" placeholderTextColor="#94A3B8" />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>Weight (kg)</Text>
              <TextInput value={weight} onChangeText={setWeight} style={styles.fieldInput} placeholder="70" placeholderTextColor="#94A3B8" keyboardType="decimal-pad" />
            </View>
          </View>

          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>Height (cm)</Text>
              <TextInput value={height} onChangeText={setHeight} style={styles.fieldInput} placeholder="170" placeholderTextColor="#94A3B8" keyboardType="decimal-pad" />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>Lunch time</Text>
              <TouchableOpacity style={styles.timeButton} onPress={() => openTimePicker('lunch')}>
                <Text style={lunchTime ? styles.timeValueText : styles.timePlaceholderText}>{lunchTime || 'Select lunch time'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Dinner time</Text>
          <TouchableOpacity style={styles.timeButton} onPress={() => openTimePicker('dinner')}>
            <Text style={dinnerTime ? styles.timeValueText : styles.timePlaceholderText}>{dinnerTime || 'Select dinner time'}</Text>
          </TouchableOpacity>

          {pickerField ? (
            <DateTimePicker
              value={pickerDate}
              mode="time"
              is24Hour
              display="default"
              onChange={handleTimePicked}
            />
          ) : null}

          <TouchableOpacity style={[styles.saveButton, saving ? styles.saveButtonDisabled : null]} onPress={handleSaveProfile} disabled={saving}>
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={[styles.summaryCard, { backgroundColor: '#FFFFFF' }]}>
        <Text style={[styles.sectionTitle, { color: '#1E293B' }]}>Summarized Report</Text>

        <View style={styles.metricRow}>
          <FileText size={18} color="#2563EB" />
          <Text style={[styles.metricText, { color: '#334155' }]}>
            Total uploaded files: {summary.totalFiles}
          </Text>
        </View>

        <View style={styles.metricRow}>
          <HeartPulse size={18} color={summary.concerningCount > 0 ? '#DC2626' : '#10B981'} />
          <Text style={[styles.metricText, { color: '#334155' }]}>
            Analyzed reports: {summary.analyzedFiles} | Needs attention: {summary.concerningCount}
          </Text>
        </View>

        <Text style={[styles.latestLabel, { color: '#2563EB' }]}>Latest insight</Text>
        <Text style={[styles.latestInsight, { color: '#475569' }]}>{summary.latestInsight}</Text>
      </View>

      <View style={[styles.settingsCard, { backgroundColor: '#FFFFFF' }]}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={16} color="#FFFFFF" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 100,
    gap: 14,
  },
  profileCard: {
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
  },
  email: {
    marginTop: 2,
    fontSize: 14,
  },
  editProfileButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  editProfileButtonText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '700',
  },
  summaryCard: {
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  rowFields: {
    flexDirection: 'row',
    gap: 10,
  },
  halfField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 6,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  timeButton: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  timeValueText: {
    fontSize: 14,
    color: '#0F172A',
  },
  timePlaceholderText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  saveButton: {
    marginTop: 10,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricText: {
    fontSize: 14,
    fontWeight: '600',
  },
  latestLabel: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
  },
  latestInsight: {
    fontSize: 14,
    lineHeight: 20,
  },
  settingsCard: {
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  logoutButton: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
