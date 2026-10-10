import { Redirect } from 'expo-router';
import { useSession } from '@/lib/session';

/** Entrada: según haya sesión o no, va al salón o al login. */
export default function Index() {
  const token = useSession((s) => s.token);
  return <Redirect href={token ? '/salon' : '/login'} />;
}
