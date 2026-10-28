// A PDF file as an HTTP answer: shown in the browser tab, or downloaded with ?download=1.
export function pdfResponse(request, { buffer, fileName }) {
  const download = new URL(request.url).searchParams.get('download') === '1';
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
