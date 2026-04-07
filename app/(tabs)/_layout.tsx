import { Tabs } from 'expo-router';
import { Home, Pill, FolderLock, FileText, UserRound } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, color }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="prescriptions"
        options={{
          title: 'Prescriptions',
          tabBarIcon: ({ size, color }) => <Pill size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="medilocker"
        options={{
          title: 'MediLocker',
          tabBarIcon: ({ size, color }) => (
            <FolderLock size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="medilens"
        options={{
          title: 'MediLens',
          tabBarIcon: ({ size, color }) => <FileText size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ size, color }) => <UserRound size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="reportanalyzer" options={{ href: null }} />
    </Tabs>
  );
}