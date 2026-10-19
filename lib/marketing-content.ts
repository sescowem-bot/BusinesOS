/** Editable marketing cards. Stored in the existing public_site_pages.sections JSONB alongside editorial sections. */
export type MarketingCard={key:string;label:string;title:string;body:string};
const cards:Record<string,[string,string,string,string][]>= {
 home:[
  ['home.ability.0','Homepage feature 1','Know every customer','Keep contact details and order history where your team can find them.'],
  ['home.ability.1','Homepage feature 2','Follow every sale','See orders, amounts received and balances still to collect.'],
  ['home.ability.2','Homepage feature 3','Send cleaner invoices','Issue professional invoices and download a PDF for your customers.'],
  ['home.ability.3','Homepage feature 4','Sell what you offer','Build a catalogue of products and services with prices.'],
  ['home.ability.4','Homepage feature 5','Manage stock & buying','Add POS, inventory and supplier workflows on eligible plans.'],
  ['home.ability.5','Homepage feature 6','See business activity','Review expenses, records and available sales reports.'],
  ['home.daily.0','Homepage workflow 1','Create a customer','Keep the right name and contact information ready for the next sale.'],
  ['home.daily.1','Homepage workflow 2','Record the order','Add products or services, totals and relevant transaction details.'],
  ['home.daily.2','Homepage workflow 3','Track the payment','Record full or part payment; keep the outstanding balance visible.'],
  ['home.daily.3','Homepage workflow 4','Issue and review','Download an invoice, export records and follow up with confidence.']
 ],
 features:[
  ['features.core.0','Core tool 1','Customers and contacts','Keep customer details in one place so you can quickly see the people behind your sales.'],
  ['features.core.1','Core tool 2','Orders and part payments','Create an order, record what the customer paid, and see the remaining balance without another spreadsheet.'],
  ['features.core.2','Core tool 3','Products and services','Maintain a clear catalogue of what you sell, with descriptions and selling prices.'],
  ['features.core.3','Core tool 4','Expenses and daily activity','Record business spending and find transactions when you need to review them.'],
  ['features.core.4','Core tool 5','Invoices and documents','Issue branded invoices linked to orders, print a clean document and download a PDF.'],
  ['features.core.5','Core tool 6','Business identity and exports','Manage business details, bring in colleagues and export available business records.'],
  ['features.advanced.0','Premium module 1','Retail point of sale','Faster checkout with product search, receipts and recorded payments. Available when your plan includes POS.'],
  ['features.advanced.1','Premium module 2','Stock management','Track quantities and stock movements, including branch stock where enabled.'],
  ['features.advanced.2','Premium module 3','Suppliers and purchasing','Manage purchase orders and goods received alongside product costs.'],
  ['features.advanced.3','Premium module 4','Team and branch controls','Support advanced staff permissions and additional locations where included.'],
  ['features.advanced.4','Premium module 5','Financial reporting','Review more detailed sales, cost and financial summaries where the recorded information supports them.'],
  ['features.advanced.5','Premium module 6','Accounting and tax records','Maintain journals and tax-related records for review. Tax filing and formal advice are not automated.']
 ],
 solutions:[
  ['solutions.case.0','Solution 1','Retail stores','Sales, payment records and product details often live in different places.'],
  ['solutions.case.1','Solution 2','Wholesalers and distributors','Large orders need clear records of what was sold, received and still outstanding.'],
  ['solutions.case.2','Solution 3','Professional services','Work completed and money collected do not always happen on the same day.'],
  ['solutions.case.3','Solution 4','Growing teams','More colleagues and locations mean more people need the right information.']
 ],
 'how-it-works':[
  ['how.steps.0','Step 1','Create your business workspace','Sign up, enter your business name and contact details, and start with the tools included in your plan.'],
  ['how.steps.1','Step 2','Add your customers and catalogue','Create customers, products or services. Bring the basics together before you start recording transactions.'],
  ['how.steps.2','Step 3','Record a sale and its payment','Create an order, record a full or part payment, and keep the amount still outstanding visible.'],
  ['how.steps.3','Step 4','Issue documents and record expenses','Prepare the customer invoice, download your PDF, and keep everyday expenses alongside business activity.'],
  ['how.steps.4','Step 5','Review records, then grow your tools','Export records and review the available summaries. Add POS, stock or finance modules only when your business needs them.']
 ]
};
const allCards:Record<string,MarketingCard[]>=Object.fromEntries(Object.entries(cards).map(([slug,items])=>[slug,items.map(([key,label,title,body])=>({key,label,title,body}))]));
export function editableMarketingCards(slug:string):MarketingCard[]{return allCards[slug]||[];}
export type MarketingSection={key?:string;heading:string;body:string};
export function marketingText(sections:MarketingSection[],key:string,fallbackTitle:string,fallbackBody:string){
 const item=sections.find(s=>s.key===key);
 return {title:item?.heading?.trim()||fallbackTitle,body:item?.body?.trim()||fallbackBody};
}
export function editorialOnly(sections:MarketingSection[]):MarketingSection[]{return sections.filter(s=>!s.key);}
