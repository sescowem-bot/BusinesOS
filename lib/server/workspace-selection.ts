import 'server-only';

/** A preference, not authorization. Every read/action still verifies membership. */
export const ACTIVE_BUSINESS_COOKIE = 'businessos_active_business';

export const businessCookieOptions = {
 httpOnly: true,
 secure: process.env.NODE_ENV === 'production',
 sameSite: 'lax' as const,
 path: '/',
 maxAge: 60 * 60 * 24 * 30
};
