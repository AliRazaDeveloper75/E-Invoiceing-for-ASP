import { redirect } from 'next/navigation';

// Self-registration is disabled — users join via invitation only.
export default function RegisterPage() {
  redirect('/login');
}
