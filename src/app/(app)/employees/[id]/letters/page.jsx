import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { listLettersFor, listTemplates } from '@/server/services/letters.service.js';
import { EmployeeLetters } from '@/features/letters/EmployeeLetters.jsx';

export const metadata = { title: 'Employee letters' };

export default async function EmployeeLettersPage({ params }) {
  const user = await requirePageUser('letters.view');
  const { id } = await params;
  const [data, templates] = await Promise.all([listLettersFor(user, id), listTemplates()]);
  return <EmployeeLetters data={toPlain(data)} templates={toPlain(templates)} />;
}
