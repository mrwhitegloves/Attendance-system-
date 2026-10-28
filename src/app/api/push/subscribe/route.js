import { withApi } from '@/server/api.js';
import { pushSubscriptionBody, unsubscribeBody } from '@/server/validation/schemas.js';
import { removeSubscription, saveSubscription } from '@/server/services/push.service.js';

// POST /api/push/subscribe — this device gets notifications for the signed-in person.
// DELETE — this device stops getting them.
export const POST = withApi({ body: pushSubscriptionBody }, async ({ user, body }) => {
  await saveSubscription(user, body);
});

export const DELETE = withApi({ body: unsubscribeBody }, async ({ user, body }) => {
  await removeSubscription(user, body.endpoint);
});
