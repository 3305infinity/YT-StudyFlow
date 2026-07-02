import type { Request, Response, NextFunction } from 'express';

import { createClerkClient, verifyToken } from '@clerk/backend';

import { env } from '../config/env.js';

import { AUTH_DISABLED, GUEST_USER_ID } from '../config/auth.config.js';



export type AuthedRequest = Request & {

  userId: string;

  userEmail?: string;

  userName?: string;

  userImageUrl?: string;

};



let clerkClient: ReturnType<typeof createClerkClient> | null = null;



function getClerkClient() {

  if (!env.clerkSecretKey) return null;

  if (!clerkClient) {

    clerkClient = createClerkClient({ secretKey: env.clerkSecretKey });

  }

  return clerkClient;

}



/** TODO: Re-enable Clerk session middleware when AUTH_DISABLED is false. */

export const clerkAuthMiddleware = (_req: Request, _res: Response, next: NextFunction) => next();



export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {

  // TODO: Remove this bypass when re-enabling authentication.

  if (AUTH_DISABLED) {

    const authed = req as AuthedRequest;

    authed.userId = GUEST_USER_ID;

    authed.userEmail = 'guest@local.dev';

    authed.userName = 'Guest';

    next();

    return;

  }



  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {

    res.status(401).json({ error: 'Unauthorized', message: 'Sign in to continue.' });

    return;

  }



  const token = header.slice('Bearer '.length).trim();

  if (!token) {

    res.status(401).json({ error: 'Unauthorized', message: 'Sign in to continue.' });

    return;

  }



  if (!env.clerkSecretKey) {

    res.status(401).json({ error: 'Unauthorized', message: 'Sign in to continue.' });

    return;

  }



  try {

    const payload = await verifyToken(token, { secretKey: env.clerkSecretKey });

    const authed = req as AuthedRequest;

    authed.userId = payload.sub;

    authed.userEmail =

      (payload.email as string | undefined) ??

      (payload.primary_email_address as string | undefined);

    authed.userName = (payload.name as string | undefined) ?? undefined;

    authed.userImageUrl = (payload.image_url as string | undefined) ?? undefined;



    const clerk = getClerkClient();

    if (clerk) {

      try {

        const user = await clerk.users.getUser(payload.sub);

        authed.userEmail =

          user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??

          authed.userEmail;

        authed.userName =

          [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||

          user.username ||

          authed.userName;

        authed.userImageUrl = user.imageUrl ?? authed.userImageUrl;

      } catch {

        // JWT is valid; profile enrichment is optional

      }

    }



    next();

  } catch {

    res.status(401).json({

      error: 'Unauthorized',

      message: 'Session expired. Sign in again in Profile.',

    });

  }

}

