// Phone numbers are compared by their last 10 digits: "+91 98765-43210" = "9876543210".

export const phoneKey = (phone) =>
  String(phone ?? '')
    .replace(/\D/g, '')
    .slice(-10);

export const isFullPhone = (phone) => phoneKey(phone).length === 10;
