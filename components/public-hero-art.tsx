import {ArrowRight, BarChart3, BookOpenText, BriefcaseBusiness, CheckCheck, CheckCircle2, ClipboardCheck, FileText, Layers3, PackageCheck, ReceiptText, ShieldCheck, ShoppingBag, Sparkles, UsersRound, Wallet} from 'lucide-react';

type HeroKey='features'|'solutions'|'how-it-works'|'about'|'resources';
/** Decorative product storytelling. No fictitious account data, customer counts or testimonials. */
export function PublicHeroArt({kind}:{kind:HeroKey}){
 if(kind==='solutions')return <div className="interior-visual interior-solutions" aria-label="Illustration of retail, service and professional business workflows">
  <span className="interior-visual-kicker"><Layers3 size={15}/> Flexible workflows</span>
  <div className="interior-solutions-stack">
   <div className="interior-solution-row"><span className="interior-glyph amber"><ShoppingBag size={23}/></span><div><strong>Retail & trading</strong><small>Products · Orders · Balances</small></div><CheckCircle2 size={19}/></div>
   <div className="interior-solution-row"><span className="interior-glyph mint"><UsersRound size={23}/></span><div><strong>Service businesses</strong><small>Clients · Quotes · Payments</small></div><CheckCircle2 size={19}/></div>
   <div className="interior-solution-row"><span className="interior-glyph blue"><BriefcaseBusiness size={23}/></span><div><strong>Professional teams</strong><small>Records · Roles · Reports</small></div><CheckCircle2 size={19}/></div>
  </div><span className="interior-visual-caption">Your workflow, connected</span>
 </div>;
 if(kind==='how-it-works')return <div className="interior-visual interior-process" aria-label="Illustration showing the four steps to organise business operations">
  <span className="interior-visual-kicker"><ClipboardCheck size={15}/> Simple steps</span>
  <ol className="interior-process-steps"><li><span>01</span><div><strong>Create a workspace</strong><small>Set up your business profile</small></div><CheckCircle2 size={18}/></li><li><span>02</span><div><strong>Add your records</strong><small>Customers and products</small></div><CheckCircle2 size={18}/></li><li><span>03</span><div><strong>Track daily activity</strong><small>Orders and payments</small></div><CheckCircle2 size={18}/></li><li><span>04</span><div><strong>Review the details</strong><small>Summaries and follow-ups</small></div><ArrowRight size={18}/></li></ol>
 </div>;
 if(kind==='about')return <div className="interior-visual interior-values" aria-label="Illustration of the platform values: clarity, ownership and progress">
  <span className="interior-visual-kicker"><Sparkles size={15}/> What matters to us</span>
  <div className="interior-values-center"><ShieldCheck size={34}/><strong>Designed for clarity</strong><span>People before complexity</span></div>
  <div className="interior-values-grid"><span><CheckCheck size={19}/> Practical tools</span><span><Layers3 size={19}/> Connected records</span><span><BarChart3 size={19}/> Better visibility</span></div>
 </div>;
 if(kind==='resources')return <div className="interior-visual interior-resources" aria-label="Illustration of practical business guides">
  <span className="interior-visual-kicker"><BookOpenText size={15}/> Learning library</span>
  <div className="interior-resource-card"><span><Wallet size={21}/></span><div><small>GUIDE 01</small><strong>Understanding customer balances</strong></div><ArrowRight size={17}/></div>
  <div className="interior-resource-card"><span><ReceiptText size={21}/></span><div><small>GUIDE 02</small><strong>Keeping clear expense records</strong></div><ArrowRight size={17}/></div>
  <div className="interior-resource-card"><span><FileText size={21}/></span><div><small>GUIDE 03</small><strong>Making sense of business reports</strong></div><ArrowRight size={17}/></div>
 </div>;
 return <div className="interior-visual interior-features" aria-label="Illustration of connected customer, sales and reporting modules">
  <span className="interior-visual-kicker"><PackageCheck size={15}/> One connected workspace</span>
  <div className="interior-feature-main"><span className="interior-glyph blue"><Layers3 size={26}/></span><div><small>EVERYDAY OPERATIONS</small><strong>Everything in its place</strong></div></div>
  <div className="interior-feature-grid"><div><UsersRound size={21}/><strong>Customers</strong><small>Relationships</small></div><div><ShoppingBag size={21}/><strong>Orders</strong><small>Sales records</small></div><div><Wallet size={21}/><strong>Payments</strong><small>Collections</small></div><div><BarChart3 size={21}/><strong>Reports</strong><small>Visibility</small></div></div>
  <span className="interior-visual-caption">Connected records, fewer loose ends</span>
 </div>;
}
