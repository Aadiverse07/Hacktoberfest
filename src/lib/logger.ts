import pino from 'pino';
import { randomUUID } from 'node:crypto';
export const logger=pino({level:process.env.LOG_LEVEL??'info'});
export function requestId(request: Request) {
  const supplied = request.headers.get('x-request-id');
  return supplied && /^[A-Za-z0-9._:-]{1,80}$/.test(supplied) ? supplied : randomUUID();
}
