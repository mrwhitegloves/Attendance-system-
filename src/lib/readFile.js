// Reads a picked file as a data URL for upload. Refuses files over the limit before sending.

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // Vercel: requests at most 4.5 MB
export const ACCEPTED_UPLOADS = 'application/pdf,image/jpeg,image/png,image/webp';

export function readFileAsDataUrl(file, maxBytes = MAX_UPLOAD_BYTES) {
  return new Promise((resolve, reject) => {
    if (file.size > maxBytes) {
      reject(new Error(`The file is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('The file could not be read.'));
    reader.readAsDataURL(file);
  });
}
