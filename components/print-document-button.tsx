'use client';
export function PrintDocumentButton(){
 return <button className="btn btn-primary print-hidden" type="button" onClick={()=>window.print()}>Print / Save PDF</button>;
}
