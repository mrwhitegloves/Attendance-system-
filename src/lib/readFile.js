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

/** Shrinks a picked image to at most `maxSide` px as a JPEG data URL (512 px: about 50 KB). */
export function shrinkImage(file, maxSide = 512) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(image.src);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    image.onerror = () => reject(new Error('This file is not a picture.'));
    image.src = URL.createObjectURL(file);
  });
}

/** A picked file for upload: photos are made smaller (phone photos are often 3–5 MB). */
export function readUploadFile(file) {
  return file.type.startsWith('image/') ? shrinkImage(file, 1800) : readFileAsDataUrl(file);
}
