import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Express, Request, Response } from 'express';

const COOKIE = 'vzcode_session';

const constantTimeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return (
    left.length === right.length &&
    timingSafeEqual(left, right)
  );
};

// Deny requests originating from another web origin, including cross-site
// WebSockets carrying ambient cookies. The explicit token is still required
// to establish a session.
export const isSameOrigin = (req: IncomingMessage) => {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (!req.headers.host || typeof origin !== 'string') {
    return false;
  }
  try {
    const parsed = new URL(origin);
    return (
      parsed.protocol === ((req.socket as any).encrypted ? 'https:' : 'http:') &&
      parsed.host === req.headers.host
    );
  } catch {
    return false;
  }
};

const sessionCookie = (req: IncomingMessage): string => {
  const cookieHeader = req.headers.cookie || '';
  const pair = cookieHeader
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(COOKIE + '='));
  return pair ? pair.slice(COOKIE.length + 1) : '';
};

export function createAccessControl(accessToken?: string) {
  const token = accessToken ?? randomBytes(32).toString('hex');
  if (token.length < 32) {
    throw new Error('Access token must have at least 32 characters');
  }
  const sessions = new Set<string>();

  const hasBearer = (req: IncomingMessage) => {
    const authorization = req.headers.authorization || '';
    return (
      authorization.startsWith('Bearer ') &&
      constantTimeEqual(authorization.slice(7), token)
    );
  };
  const authorized = (req: IncomingMessage) => {
    const session = sessionCookie(req);
    return (
      isSameOrigin(req) &&
      (hasBearer(req) || (session !== '' && sessions.has(session)))
    );
  };

  const install = (app: Express) => {
    app.post('/auth/session', (req: Request, res: Response) => {
      if (!isSameOrigin(req) || !hasBearer(req)) {
        res.sendStatus(401);
        return;
      }
      const session = randomBytes(32).toString('hex');
      sessions.add(session);
      const secure = req.secure ? '; Secure' : '';
      res.setHeader(
        'Set-Cookie',
        COOKIE + '=' + session +
          '; HttpOnly; SameSite=Strict; Path=/' + secure,
      );
      res.sendStatus(204);
    });

    app.get('/auth/status', (req: Request, res: Response) => {
      res.status(authorized(req) ? 200 : 401).json({
        authenticated: authorized(req),
      });
    });

    app.post('/auth/logout', (req: Request, res: Response) => {
      const session = sessionCookie(req);
      if (!authorized(req)) {
        res.sendStatus(401);
        return;
      }
      sessions.delete(session);
      res.setHeader(
        'Set-Cookie',
        COOKIE + '=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',
      );
      res.sendStatus(204);
    });
  };

  const requireAuth = (req: Request, res: Response, next: () => void) => {
    if (!authorized(req)) {
      res.sendStatus(401);
      return;
    }
    next();
  };

  return {
    token,
    install,
    authorized,
    requireAuth,
    close: () => sessions.clear(),
  };
}
