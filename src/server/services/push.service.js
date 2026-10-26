import { PushSubscription } from '../models/system.models.js';
import { User } from '../models/user.model.js';
import { ROLES } from '../permissions/roles.js';
import { sendPush } from '../infra/push.js';

// Push subscriptions and who gets which notification.

export async function saveSubscription(user, { endpoint, keys }) {
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { endpoint, keys, userId: user._id, adminId: null },
    { upsert: true },
  );
}

export async function removeSubscription(user, endpoint) {
  await PushSubscription.deleteOne({ endpoint, userId: user._id });
}

/** Sends to every device of the given users. Expired subscriptions are removed. */
export async function notifyUsers(userIds, payload) {
  if (!userIds.length) return { sent: 0, total: 0 };
  const subscriptions = await PushSubscription.find({ userId: { $in: userIds } }).lean();
  let sent = 0;
  for (const subscription of subscriptions) {
    const result = await sendPush(subscription, payload);
    if (result === 'sent') sent += 1;
    if (result === 'gone') await PushSubscription.deleteOne({ _id: subscription._id });
  }
  return { sent, total: subscriptions.length };
}

/** Active users whose role has a permission. */
async function usersWithPermission(permission) {
  const roleKeys = Object.entries(ROLES)
    .filter(([, role]) => role.permissions[permission])
    .map(([key]) => key);
  const users = await User.find({ roleKey: { $in: roleKeys }, status: 'active' }, '_id').lean();
  return users.map((user) => user._id);
}

/** Punch and sign-in alerts for the people who follow them (CEO, HR). */
export async function notifyPunchWatchers(payload) {
  return notifyUsers(await usersWithPermission('notifications.punches'), payload);
}

/** A message from HR to every active employee. */
export async function broadcastToEmployees({ title, body }) {
  const users = await User.find({ status: 'active' }, '_id').lean();
  return notifyUsers(
    users.map((user) => user._id),
    { title, body, icon: '/logo.png', data: { url: '/dashboard' } },
  );
}
