// Company assets given to employees (CEO spec: "laptop, ID card, kit and other assigned company
// assets"). Shared by the server (model, validation) and the screens.

export const ASSET_CATEGORIES = {
  laptop: 'Laptop',
  desktop: 'Desktop',
  phone: 'Phone',
  sim: 'SIM card',
  id_card: 'ID card',
  access_card: 'Access card',
  vehicle: 'Vehicle',
  uniform: 'Uniform / kit',
  tools: 'Tools',
  other: 'Other',
};

export const ASSET_STATUSES = {
  in_stock: 'In stock',
  assigned: 'With employee',
  under_repair: 'Under repair',
  lost: 'Lost',
  retired: 'Retired',
};

export const ASSET_STATUS_TONE = {
  in_stock: 'success',
  assigned: 'info',
  under_repair: 'warning',
  lost: 'danger',
  retired: 'neutral',
};

/** Where an asset can go when it comes back, or while nobody has it. */
export const RETURN_STATUSES = ['in_stock', 'under_repair', 'lost'];
export const IDLE_STATUSES = ['in_stock', 'under_repair', 'lost', 'retired'];

const toList = (labels, keys = Object.keys(labels)) =>
  keys.map((value) => ({ value, label: labels[value] }));

export const assetCategoryOptions = toList(ASSET_CATEGORIES);
export const assetStatusOptions = toList(ASSET_STATUSES);
export const returnStatusOptions = toList(ASSET_STATUSES, RETURN_STATUSES);
export const idleStatusOptions = toList(ASSET_STATUSES, IDLE_STATUSES);
