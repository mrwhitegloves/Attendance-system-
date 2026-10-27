import { redirect } from 'next/navigation';
import { requirePageUser } from '@/server/auth/current.js';

export default async function SettingsPage() {
  await requirePageUser('settings.manage');
  redirect('/settings/lists');
}
