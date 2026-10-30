import Image from 'next/image';
import { connectDb } from '@/server/db.js';
import { getPublicKyc } from '@/server/services/kycLinks.service.js';
import { BRANDS } from '@/config/brands.js';
import { BRANDING } from '@/config/branding.js';
import { Card } from '@/components/shared/ui.jsx';
import { KycForm, Thanks } from '@/features/kycLinks/KycForm.jsx';

// The employee's KYC form from the link HR sent. No sign-in: the token in the address is the key.
export const metadata = { title: 'KYC form', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function KycPage({ params }) {
  const { token } = await params;
  await connectDb();
  let data = null;
  let problem = '';
  try {
    data = await getPublicKyc(token);
  } catch (error) {
    problem = error.isAppError
      ? error.message
      : 'Something went wrong. Please try again in a minute.';
    if (!error.isAppError) console.error('[kyc form]', error);
  }
  const company = BRANDS[data?.brandKey]?.label ?? BRANDING.companyName;
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <header className="mb-5 flex items-center gap-3">
        <Image src={BRANDING.logo} alt="" width={40} height={40} className="rounded-lg" />
        <div>
          <h1 className="text-lg font-semibold">Employee KYC form</h1>
          <p className="text-sm text-muted">{company}</p>
        </div>
      </header>
      {problem ? (
        <Card className="p-6 text-center text-sm">{problem}</Card>
      ) : data.state !== 'open' ? (
        <Thanks name={data.name} />
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            Hello <span className="font-medium text-text">{data.name}</span>, please fill in your
            details and upload the files. Fields with <span className="text-danger">*</span> on
            files are needed. Everything you send goes only to HR.
          </p>
          <KycForm token={token} data={data} />
        </>
      )}
    </main>
  );
}
