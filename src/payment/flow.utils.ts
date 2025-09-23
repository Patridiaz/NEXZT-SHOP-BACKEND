// flow.utils.ts
import crypto from 'crypto';

export function buildSignature(params: Record<string, any>, secretKey: string) {
  const keys = Object.keys(params).sort();
  const str = keys.map(k => `${k}=${params[k]}`).join('');
  return crypto.createHmac('sha1', secretKey).update(str).digest('hex');
}
