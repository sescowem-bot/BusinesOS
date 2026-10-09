import {getWorkspace} from '@/lib/server/workspace';
export const dynamic='force-dynamic';
export default async function Marketplace(){
 const {client}=await getWorkspace();
 const {data,error}=await client.from('businesses').select('id,name,category,description,city,state,verified,featured').eq('published',true).order('featured',{ascending:false}).limit(36);
 if(error)throw new Error('Unable to load published business profiles.');
 return <div className="tax-page"><p className="small muted">DISCOVER</p><h1>Business directory</h1><p className="muted">Only published businesses appear here. Rankings and customer ratings are not generated or invented.</p><div className="grid grid-3">{(data||[]).map(b=><section key={b.id} className="card card-pad"><h2>{b.name}</h2><p className="small muted">{b.category}{b.city?` · ${b.city}`:''}{b.state?`, ${b.state}`:''}</p>{b.featured&&<span className="badge">Featured</span>}{b.verified&&<span className="badge">Verified</span>}<p className="muted">{b.description||'No business description published yet.'}</p><p className="small muted">Public contact and storefront links are not yet enabled.</p></section>)}</div>{!data?.length&&<div className="card card-pad"><h2>No published businesses yet</h2><p>Businesses will appear after publication is enabled and their profiles are approved.</p></div>}</div>;
}
