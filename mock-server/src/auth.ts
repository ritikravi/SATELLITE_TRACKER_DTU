import { Request, Response, NextFunction } from 'express';

const VALID_TOKEN = process.env.TRACKER_AUTH_TOKEN;

// Rate limiting state for failed auth attempts
interface FailedAttemptInfo {
  count: number;
  firstAttemptTime: number;
  blockedUntil: number;
}

const failedAttempts = new Map<string, FailedAttemptInfo>();
const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000;       // 1 minute window
const BLOCK_DURATION_MS = 30 * 1000;// 30 second cooldown

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const now = Date.now();

  if (!VALID_TOKEN) {
    res.status(500).json({
      success: false,
      error: 'Server configuration error: TRACKER_AUTH_TOKEN environment variable is not defined.',
      timestamp: new Date().toISOString()
    });
    return;
  }

  const record = failedAttempts.get(ip);
  if (record && record.blockedUntil > now) {
    const remainingSec = Math.ceil((record.blockedUntil - now) / 1000);
    res.status(429).json({
      success: false,
      error: `Too many failed authentication attempts. Rate limited for ${remainingSec}s.`,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Check auth header
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'];

  let token: string | undefined;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (typeof apiKeyHeader === 'string') {
    token = apiKeyHeader.trim();
  }

  if (token === VALID_TOKEN) {
    // Auth successful: clear failure record
    if (record) {
      failedAttempts.delete(ip);
    }
    next();
    return;
  }

  // Failed auth: track attempt
  if (!record || now - record.firstAttemptTime > WINDOW_MS) {
    failedAttempts.set(ip, {
      count: 1,
      firstAttemptTime: now,
      blockedUntil: 0
    });
  } else {
    record.count += 1;
    if (record.count >= MAX_FAILED_ATTEMPTS) {
      record.blockedUntil = now + BLOCK_DURATION_MS;
      res.status(429).json({
        success: false,
        error: `Too many failed authentication attempts. Blocked for 30 seconds.`,
        timestamp: new Date().toISOString()
      });
      return;
    }
  }

  res.status(401).json({
    success: false,
    error: 'Unauthorized: Valid Bearer token or X-API-Key required for motor control & configuration.',
    timestamp: new Date().toISOString()
  });
}

