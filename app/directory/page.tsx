import Link from 'next/link';
import {getServerSupabase} from '@/lib/server/supabase';
import {getPlatformBrand} from '@/lib/server/branding';
import PublicNav from '@/components/public-nav';
import PublicFooter from '@/components/public-footer';

/** Public, opt-in directory fields returned by SQL 046: public_directory_list(). */
type DirectoryBusiness = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  description: string | null;
  logo_url: string | null;
  city: string | null;
  state: string | null;
};

function isDirectoryBusiness(value: unknown): value is DirectoryBusiness {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.slug !== 'string' || typeof record.name !== 'string') return false;
  return (['category', 'description', 'logo_url', 'city', 'state'] as const).every(
    (key) => record[key] === null || typeof record[key] === 'string'
  );
}

export const dynamic = 'force-dynamic';

export default async function BusinessDirectory() {
  const [client, brand] = await Promise.all([getServerSupabase(), getPlatformBrand()]);
  const {data, error} = client
    ? await client.rpc('public_directory_list')
    : {data: null, error: true};

  // Public directory rows are not generated as typed Supabase RPC results.
  // Accept only validated, opt-in business profiles; never expose user records.
  const rawBusinesses: unknown = data;
  const businesses: DirectoryBusiness[] = Array.isArray(rawBusinesses)
    ? rawBusinesses.filter(isDirectoryBusiness)
    : [];

  return <main className="marketing-site">
    <PublicNav name={brand.name} logo={brand.logo_url} access="guest"/>
    <section className="marketing-section">
      <div className="marketing-container">
        <span className="marketing-kicker">BUSINESS DIRECTORY</span>
        <h1>Discover verified businesses</h1>
        <p>Explore businesses that have chosen to share their profiles publicly.</p>
        <div className="grid grid-3" style={{marginTop:26}}>
          {businesses.map((business) =>
            <Link
              href={`/directory/${encodeURIComponent(business.slug)}`}
              className="card card-pad bo-directory-card"
              key={business.id}
            >
              {business.logo_url && /^https:\/\//.test(business.logo_url)
                ? <img src={business.logo_url} alt="" className="bo-business-logo"/>
                : <span className="bo-business-logo bo-business-logo-fallback">{business.name.slice(0,1)}</span>}
              <h2>{business.name}</h2>
              <p className="small muted">
                {business.category}{business.city ? ` · ${business.city}` : ''}{business.state ? `, ${business.state}` : ''}
              </p>
              <p>{business.description || 'View the business profile and contact details.'}</p>
              <span className="small">View business →</span>
            </Link>
          )}
        </div>
        {error && <div className="card card-pad" role="alert">The business directory is temporarily unavailable. Please try again soon.</div>}
        {!error && businesses.length===0 && <div className="card card-pad" style={{marginTop:24}}>
          <h2>More businesses coming soon</h2>
          <p>Verified businesses that choose public listing will appear here.</p>
        </div>}
      </div>
    </section>
    <PublicFooter name={brand.name} tagline={brand.tagline} email={brand.support_email}/>
  </main>;
}
