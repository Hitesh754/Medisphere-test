export const mockUser = {
  name: 'Sarah',
  greeting: 'Good morning',
};

export const mockMedications = [
  {
    id: '1',
    name: 'Metformin',
    dosage: '500mg',
    time: '8:00 AM',
    type: 'Before breakfast',
  },
  {
    id: '2',
    name: 'Lisinopril',
    dosage: '10mg',
    time: '9:00 PM',
    type: 'After dinner',
  },
];

export const mockHealthInsights = [
  {
    id: '1',
    title: 'Blood Sugar Levels',
    description: 'Your recent blood sugar is within the normal range',
    status: 'positive',
    date: '2 days ago',
  },
  {
    id: '2',
    title: 'Blood Pressure',
    description: 'Readings show consistent improvement',
    status: 'positive',
    date: '1 week ago',
  },
];

export const mockPrescriptions = [
  {
    id: '1',
    medicineName: 'Metformin',
    dosage: '500mg',
    frequency: 'Twice daily',
    timing: 'Morning & Evening',
    mealTiming: 'Before meals',
    duration: '30 days',
    warnings: [
      'Take with a full glass of water',
      'May cause stomach upset initially',
      'Avoid alcohol while taking this medication',
    ],
    prescribedBy: 'Dr. James Wilson',
    prescribedDate: '2024-02-15',
    purpose: 'To manage blood sugar levels',
  },
  {
    id: '2',
    medicineName: 'Lisinopril',
    dosage: '10mg',
    frequency: 'Once daily',
    timing: 'Evening',
    mealTiming: 'After dinner',
    duration: '90 days',
    warnings: [
      'May cause dizziness when standing up quickly',
      'Stay well hydrated',
      'Report any persistent cough to your doctor',
    ],
    prescribedBy: 'Dr. James Wilson',
    prescribedDate: '2024-02-15',
    purpose: 'To manage blood pressure',
  },
];

export const mockDocuments = [
  {
    id: '1',
    title: 'Blood Test Results',
    type: 'Lab Report',
    date: '2024-02-20',
    fileSize: '2.3 MB',
  },
  {
    id: '2',
    title: 'Metformin Prescription',
    type: 'Prescription',
    date: '2024-02-15',
    fileSize: '1.1 MB',
  },
  {
    id: '3',
    title: 'COVID-19 Vaccination Card',
    type: 'Vaccination',
    date: '2023-11-10',
    fileSize: '890 KB',
  },
  {
    id: '4',
    title: 'Annual Physical Exam',
    type: 'Lab Report',
    date: '2024-01-05',
    fileSize: '3.2 MB',
  },
  {
    id: '5',
    title: 'Lisinopril Prescription',
    type: 'Prescription',
    date: '2024-02-15',
    fileSize: '1.0 MB',
  },
  {
    id: '6',
    title: 'Cholesterol Panel',
    type: 'Lab Report',
    date: '2024-01-20',
    fileSize: '1.8 MB',
  },
];
