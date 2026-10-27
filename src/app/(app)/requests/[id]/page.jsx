import { notFound } from 'next/navigation';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { getRequest } from '@/server/services/requests.service.js';
import { RequestDetail } from '@/features/requests/RequestDetail.jsx';

export const metadata = { title: 'Request' };

export default async function RequestPage({ params }) {
  const user = await requirePageUser();
  const { id } = await params;
  const request = await getRequest(user, id).catch((error) => {
    if (error.status === 404) notFound();
    throw error;
  });
  return <RequestDetail request={toPlain(request)} />;
}
