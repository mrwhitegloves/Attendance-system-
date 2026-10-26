// Shared list query: filter (permission scope first), allowed sort, page and size.

/**
 * @param {import('mongoose').Model} Model
 * @param {{ filter: object, sort: object, page?: number, pageSize?: number, projection?: string }} options
 */
export async function runListQuery(Model, { filter, sort, page = 1, pageSize = 25, projection }) {
  const safePage = Math.max(1, page);
  const [items, total] = await Promise.all([
    Model.find(filter, projection)
      .sort(sort)
      .skip((safePage - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Model.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page: safePage,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Escapes text for a case-insensitive "contains" search. */
export const containsRegex = (text) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
