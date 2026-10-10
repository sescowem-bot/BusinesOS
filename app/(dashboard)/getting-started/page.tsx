import Link from 'next/link';
import {getWorkspace} from '@/lib/server/workspace';
import {BusinessPageHeading,BusinessAlert} from '@/components/business-page-ui';
import {CheckCircle2,ArrowRight,Users,ClipboardList,Wallet,Receipt,ShieldCheck,HelpCircle} from 'lucide-react';
export const dynamic='force-dynamic';
type Step={title:string;description:string;href:string;action:string;complete:boolean|null;icon:typeof Users};
export default async function GettingStarted(){
 const {client,businessId,role}=await getWorkspace();
 // These are count-only indexed queries. No customer PII or order lists cross the network.
 const [customers,orders,products]=await Promise.all([
  client.from('business_customers').select('customer_id',{count:'exact',head:true}).eq('business_id',businessId),
  client.from('orders').select('id',{count:'exact',head:true}).eq('business_id',businessId),
  client.from('products').select('id',{count:'exact',head:true}).eq('business_id',businessId)
 ]);
 const sales=['owner','manager','finance','sales'].includes(role);
 const manager=['owner','manager'].includes(role);
 const canEditProducts=['owner','manager','inventory'].includes(role);
 const countDone=(count:number|null,error:unknown):boolean|null=>error||count===null?null:count>0;
 const steps:Step[]=[
  {title:'Add your first customer',description:'Keep a name and contact details so every order and payment has a clear customer history.',href:sales?'/customers/new':'/customers',action:sales?'Add customer':'View customers',complete:countDone(customers.count,customers.error),icon:Users},
  {title:'Record a product or service',description:'Set up what your business sells. Stock-tracked products can later be used in Retail POS.',href:canEditProducts?'/products/new':'/products',action:canEditProducts?'Add product or service':'View products',complete:countDone(products.count,products.error),icon:Receipt},
  {title:'Create an order and choose payment status',description:'Select Not paid, Part payment or Paid in full before saving. BusinessOS records the outstanding balance.',href:sales?'/orders/new':'/support',action:sales?'Create an order':'Ask for sales access',complete:countDone(orders.count,orders.error),icon:ClipboardList},
  {title:'Review collections and balances',description:'Check unpaid orders, record only verified customer payments and open printable order statements.',href:'/orders',action:'Review orders',complete:null,icon:Wallet},
  ...(manager?[{title:'Invite the right people',description:'Add staff with the permissions they need. Business ownership stays separate from platform administration.',href:'/team',action:'Manage staff roles',complete:null,icon:ShieldCheck} as Step]:[])
 ];
 const recorded=steps.filter(s=>s.complete!==null);
 const completed=recorded.filter(s=>s.complete).length;
 return <div className="bo-page bo-getting-started">
  <BusinessPageHeading eyebrow="YOUR BUSINESS / QUICK START" title="Get comfortable with BusinessOS" description="A simple guide to your first customer, first order and first payment. You can return whenever you need." action={{href:'/dashboard',label:'Go to dashboard'}}/>
  <section className="bo-start-summary" aria-label="Workspace setup progress"><div><p className="bo-eyebrow">YOUR PROGRESS</p><h2>{completed} of {recorded.length} recorded setup actions</h2><p>Only saved customers, products and orders count towards this progress. There is no pressure to complete everything at once.</p></div><Link className="btn" href="/support">Ask for help <ArrowRight size={15}/></Link></section>
  {recorded.length!==3&&<BusinessAlert>Some setup counts could not be verified. Existing records have not been changed. Try again later for an updated overview.</BusinessAlert>}
  <section className="bo-start-steps" aria-label="Steps to set up your workspace">{steps.map((step,i)=>{const Icon=step.icon;return <article className="bo-start-step" key={step.title}>
   <div className="bo-start-step-icon"><Icon size={23} aria-hidden="true"/></div>
   <div className="bo-start-step-body"><div className="bo-start-step-heading"><span className="bo-eyebrow">STEP {i+1}</span>{step.complete===true&&<span className="bo-start-done"><CheckCircle2 size={15}/>Already recorded</span>}</div><h2>{step.title}</h2><p>{step.description}</p><Link href={step.href} className="bo-start-action">{step.action}<ArrowRight size={17}/></Link></div>
  </article>})}</section>
  {!sales&&<BusinessAlert>Your role may restrict creating sales orders or viewing customer payments. Ask the business owner to review your role under Team & Branches.</BusinessAlert>}
  <section className="bo-start-help"><HelpCircle size={22}/><div><h2>Need help with an order or your account?</h2><p>Open a support request with a short description. Never send your password, API keys or customers' private details in a support message.</p><Link href="/support" className="btn">Contact BusinessOS support</Link></div></section>
 </div>;
}
