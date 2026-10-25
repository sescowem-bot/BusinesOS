import Link from 'next/link';
import {redirect} from 'next/navigation';
import {getWorkspace} from '@/lib/server/workspace';
import {coreActionAllowed} from '@/lib/server/core-action-permissions';
import {ItemForm} from '../../catalog/forms';
export default async function AddProduct(){
 const access=await getWorkspace();
 if(!['owner','manager','inventory'].includes(access.role)||!(await coreActionAllowed(access,'products','create')))redirect('/products');
 return <div className="tax-page"><p className="muted small">CATALOG</p><h1>Add a product or service</h1><p><Link href="/products">← Back to catalogue</Link></p><section className="tax-panel"><ItemForm/></section></div>;
}
