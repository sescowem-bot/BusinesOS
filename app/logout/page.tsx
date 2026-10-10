import Link from 'next/link';
import {getServerSupabase} from '@/lib/server/supabase';
import {getPlatformBrand} from '@/lib/server/branding';
import {signOut} from '../(auth)/login/actions';

export const dynamic = 'force-dynamic';

export default async function LogoutPage() {
  const [supabase, brand] = await Promise.all([getServerSupabase(), getPlatformBrand()]);
  const session = supabase ? await supabase.auth.getUser() : null;
  const user = session?.data.user;

  return (
    <main className="auth">
      <section className="auth-card" aria-labelledby="logout-heading">
        <Link href="/" className="brand" aria-label={`${brand.name} homepage`}>
          <span className="brand-mark">{(brand.short_name || brand.name).slice(0, 1).toUpperCase()}</span>
          <span>{brand.name}</span>
        </Link>
        <h1 id="logout-heading">{user ? 'Sign out of your account?' : 'Sign out'}</h1>
        <p className="muted">
          {user ? 'This will end your current session on this browser. Your business records will remain safe.'
            : 'Use the button below to end any current session and return to the sign-in page.'}
        </p>
        {user?.email && <p className="small muted">Signed in as <strong>{user.email}</strong></p>}
        <form action={signOut} style={{ marginTop: 24 }}>
          <button className="btn btn-primary" type="submit">Sign out now</button>
        </form>
        <p style={{ marginTop: 18 }}><Link href={user ? '/dashboard' : '/login'} className="small">{user ? 'Cancel and return to workspace' : 'Return to sign in'}</Link></p>
      </section>
    </main>
  );
}
