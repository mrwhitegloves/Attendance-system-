import { withApi } from '@/server/api.js';
import { broadcastBody } from '@/server/validation/schemas.js';
import { broadcastToEmployees } from '@/server/services/push.service.js';
import { recordAudit } from '@/server/services/audit.service.js';

// POST /api/push/broadcast — a notification to every active employee.
export const POST = withApi(
  { permission: 'notifications.broadcast', body: broadcastBody },
  async ({ user, body, ip }) => {
    const result = await broadcastToEmployees(body);
    await recordAudit(user, {
      action: 'push.broadcast',
      entity: 'notification',
      summary: body.title,
      ip,
    });
    return result;
  },
);
