import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/utils/firebase';

export default function Index() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
    });

    return unsubscribe;
  }, []);

  if (user === undefined) {
    return null;
  }

  return <Redirect href={user ? '/(tabs)' : '/(auth)/login'} />;
}
