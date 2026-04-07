import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/utils/firebase';

export interface UserProfile {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  gender?: string;
  weight?: string;
  height?: string;
  lunchTime?: string;
  dinnerTime?: string;
  createdAt?: Timestamp;
}

export interface UploadedFile {
  id: string;
  userId: string;
  title: string;
  type: string;
  mimeType: string;
  fileSizeBytes: number;
  fileSizeLabel: string;
  downloadURL: string;
  storagePath: string;
  createdAt?: Timestamp;
  analysisSummary?: string;
  labResultsCount?: number;
  insightSeverity?: 'positive' | 'negative' | 'neutral';
}

export interface MedicationReminder {
  id: string;
  userId: string;
  medicineName: string;
  dosage?: string;
  frequency?: string;
  mealTiming?: string;
  reminderTime: string;
  days: string[];
  autoScheduled?: boolean;
  source?: string;
  notificationIds?: string[];
  createdAt?: Timestamp;
}

const toFileSizeLabel = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
};

export const saveUserProfile = async (profile: Omit<UserProfile, 'createdAt'>) => {
  await setDoc(
    doc(db, 'users', profile.uid),
    {
      ...profile,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const getUserProfile = async (uid: string) => {
  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) {
    return null;
  }
  return snapshot.data() as UserProfile;
};

export const listUserFiles = async (uid: string) => {
  const q = query(collection(db, 'files'), where('userId', '==', uid));
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((docItem) => ({ id: docItem.id, ...docItem.data() } as UploadedFile))
    .sort((a, b) => {
      const aTime = a.createdAt?.seconds ?? 0;
      const bTime = b.createdAt?.seconds ?? 0;
      return bTime - aTime;
    });
};

export const createFileRecord = async (data: {
  userId: string;
  title: string;
  type: string;
  mimeType: string;
  fileSizeBytes: number;
  downloadURL: string;
  storagePath: string;
  analysisSummary?: string;
  labResultsCount?: number;
  insightSeverity?: 'positive' | 'negative' | 'neutral';
}) => {
  await addDoc(collection(db, 'files'), {
    ...data,
    fileSizeLabel: toFileSizeLabel(data.fileSizeBytes),
    createdAt: serverTimestamp(),
  });
};

export const deleteUserFileRecord = async (userId: string, fileId: string) => {
  const fileRef = doc(db, 'files', fileId);
  const snapshot = await getDoc(fileRef);

  if (!snapshot.exists()) {
    return;
  }

  const data = snapshot.data() as UploadedFile;
  if (data.userId !== userId) {
    throw new Error('Unauthorized delete attempt');
  }

  await deleteDoc(fileRef);
};

export const listUserMedicationReminders = async (uid: string) => {
  const q = query(collection(db, 'medicationReminders'), where('userId', '==', uid));
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((docItem) => ({ id: docItem.id, ...docItem.data() } as MedicationReminder))
    .sort((a, b) => {
      const aTime = a.createdAt?.seconds ?? 0;
      const bTime = b.createdAt?.seconds ?? 0;
      return bTime - aTime;
    });
};

export const createMedicationReminder = async (data: {
  userId: string;
  medicineName: string;
  dosage?: string;
  frequency?: string;
  mealTiming?: string;
  reminderTime: string;
  days: string[];
  autoScheduled?: boolean;
  source?: string;
  notificationIds?: string[];
}) => {
  const reminderRef = await addDoc(collection(db, 'medicationReminders'), {
    ...data,
    createdAt: serverTimestamp(),
  });

  return reminderRef.id;
};

export const updateMedicationReminder = async (
  userId: string,
  reminderId: string,
  data: Partial<{
    medicineName: string;
    dosage: string;
    frequency: string;
    mealTiming: string;
    reminderTime: string;
    days: string[];
    autoScheduled: boolean;
    source: string;
    notificationIds: string[];
  }>
) => {
  const reminderRef = doc(db, 'medicationReminders', reminderId);
  const snapshot = await getDoc(reminderRef);

  if (!snapshot.exists()) {
    return;
  }

  const existing = snapshot.data() as MedicationReminder;
  if (existing.userId !== userId) {
    throw new Error('Unauthorized update attempt');
  }

  await updateDoc(reminderRef, data);
};

export const deleteMedicationReminder = async (userId: string, reminderId: string) => {
  const reminderRef = doc(db, 'medicationReminders', reminderId);
  const snapshot = await getDoc(reminderRef);

  if (!snapshot.exists()) {
    return null;
  }

  const existing = snapshot.data() as MedicationReminder;
  if (existing.userId !== userId) {
    throw new Error('Unauthorized delete attempt');
  }

  await deleteDoc(reminderRef);
  return existing;
};
