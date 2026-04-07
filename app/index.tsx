import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/utils/firebase';

export default function Index() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    const fallbackTimer = setTimeout(() => {
      // Avoid a permanent blank screen if auth state callback never resolves on web.
      if (isMounted) {
        setUser((current) => (current === undefined ? null : current));
      }
    }, 2500);

    let unsubscribe = () => undefined;

    try {
      unsubscribe = onAuthStateChanged(auth, (nextUser) => {
        if (isMounted) {
          setUser(nextUser);
        }
      });
    } catch {
      if (isMounted) {
        setUser(null);
      }
    }

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  if (user === undefined) {
    return null;
  }

  return <Redirect href={user ? '/(tabs)' : '/(auth)/login'} />;
}
