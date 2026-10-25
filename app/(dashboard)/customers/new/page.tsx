import Link from 'next/link';
import {redirect} from 'next/navigation';
import {getWorkspace} from '@/lib/server/workspace';
import {coreActionAllowed} from '@/lib/server/core-action-permissions';
import {CustomerForm} from '../../sales/forms';
import {BusinessPageHeading} from '@/components/business-page-ui';
export default async function NewCustomer(){const a=await getWorkspace();if(!['owner','manager','finance','sales'].includes(a.role)||!(await coreActionAllowed(a,'customers','create')))redirect('/customers');return <div className="bo-page bo-form-page"><BusinessPageHeading eyebrow="CUSTOMERS / NEW RECORD" title="Add a customer" description="Store customer contact details in your selected business workspace."/><p className="bo-back-link"><Link href="/customers">← Back to customers</Link></p><section className="bo-form-panel"><div className="bo-form-head"><h2>Customer information</h2><p>Only the customer name is required. You can add contact details now or leave them blank.</p></div><CustomerForm/></section></div>}
