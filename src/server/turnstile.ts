/* eslint-disable no-console */
import { Request, Response } from 'express';

interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

/**
 * Verify Cloudflare Turnstile token
 */
export async function verifyTurnstileToken(token: string, ip?: string): Promise<boolean> {
  const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    return true; // Allow in development
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (ip) {
      formData.append('remoteip', ip);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data: TurnstileResponse = await response.json();

    if (!data.success) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Middleware to verify Turnstile token
 * Checks for cf-turnstile-token header or turnstileToken query parameter
 */
export function turnstileMiddleware(req: Request, res: Response, next: () => void) {
  // Skip if Turnstile is not enabled
  if (process.env.CLOUDFLARE_TURNSTILE_ENABLED !== 'true') {
    return next();
  }

  // Skip for allowed domains (your frontend)
  const referer = req.get('referer') || req.get('origin') || '';
  const allowedDomains = process.env.ALLOWED_DOMAINS?.split(',').map((d) => d.trim()) || [];

  const isAllowedDomain = allowedDomains.some((domain) => referer.includes(domain));

  if (isAllowedDomain) {
    // Allowed domain, but still verify token if provided
    const token = req.get('cf-turnstile-token') || (req.query.turnstileToken as string);

    if (!token) {
      return next(); // Allow without token for whitelisted domains
    }

    // Verify token
    verifyTurnstileToken(token, req.ip)
      .then((valid) => {
        if (valid) {
          return next();
        }
        return res.status(403).json({ error: 'Invalid challenge response' });
      })
      .catch(() => {
        return res.status(500).json({ error: 'Challenge verification failed' });
      });
  } else {
    // Not an allowed domain - require valid token
    const token = req.get('cf-turnstile-token') || (req.query.turnstileToken as string);

    if (!token) {
      return res.status(403).json({
        error: 'Challenge required',
        message: 'Please complete the security challenge',
      });
    }

    verifyTurnstileToken(token, req.ip)
      .then((valid) => {
        if (valid) {
          return next();
        }
        return res.status(403).json({ error: 'Invalid challenge response' });
      })
      .catch(() => {
        return res.status(500).json({ error: 'Challenge verification failed' });
      });
  }
}
