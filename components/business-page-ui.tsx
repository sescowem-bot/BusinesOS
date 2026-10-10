import Link from 'next/link';
import type {ReactNode} from 'react';

export function BusinessPageHeading({eyebrow,title,description,action}:{eyebrow:string;title:string;description:string;action?:{href:string;label:string}}){
 return <header className="bo-page-heading"><div><p className="bo-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="bo-page-description">{description}</p></div>{action&&<Link className="btn btn-primary bo-heading-action" href={action.href}>+ {action.label}</Link>}</header>;
}
export function BusinessSummary({items}:{items:{label:string;value:ReactNode;detail?:string;warning?:boolean}[]}){
 return <div className="bo-summary-grid">{items.map(item=><section className={`bo-summary-card${item.warning?' bo-summary-warn':''}`} key={item.label}><span>{item.label}</span><strong>{item.value}</strong>{item.detail&&<small>{item.detail}</small>}</section>)}</div>;
}
export function BusinessSection({title,description,children}:{title:string;description?:string;children:ReactNode}){
 return <section className="bo-section"><div className="bo-section-heading"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div></div>{children}</section>;
}
export function BusinessAlert({children}:{children:ReactNode}){return <div className="bo-data-alert" role="alert">{children}</div>}
