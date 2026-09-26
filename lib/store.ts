export type Business={id:string;name:string;category:string;description:string;phone:string;whatsapp:string;city:string;featured:boolean};
export type ProductRecord={id:string;businessId:string;name:string;type:'Product'|'Service'|'Package';category:string;price:number;cost:number;stock:number;minStock:number;description:string;active:boolean};
const BUSINESS_KEY='businessos_business';const PRODUCT_KEY='businessos_products';
export const defaultBusiness:Business={id:'local-business',name:'My Business',category:'Retail',description:'A professional business on BusinessOS.',phone:'',whatsapp:'',city:'Lagos',featured:false};
export function loadBusiness():Business{if(typeof window==='undefined')return defaultBusiness;try{return {...defaultBusiness,...JSON.parse(localStorage.getItem(BUSINESS_KEY)||'{}')}}catch{return defaultBusiness}}
export function saveBusiness(value:Business){localStorage.setItem(BUSINESS_KEY,JSON.stringify(value))}
export function loadProducts():ProductRecord[]{if(typeof window==='undefined')return [];try{return JSON.parse(localStorage.getItem(PRODUCT_KEY)||'[]')}catch{return []}}
export function saveProducts(value:ProductRecord[]){localStorage.setItem(PRODUCT_KEY,JSON.stringify(value))}
export const publicBusinesses:Business[]=[
{id:'mariam-styles',name:'Mariam Styles',category:'Fashion',description:'Contemporary fashion, custom pieces and ready-to-wear collections.',phone:'+234 801 000 0001',whatsapp:'+234 801 000 0001',city:'Lagos',featured:true},
{id:'tasty-bowl',name:'Tasty Bowl Kitchen',category:'Food',description:'Fresh meals, catering and event food services.',phone:'+234 801 000 0002',whatsapp:'+234 801 000 0002',city:'Lagos',featured:true},
{id:'prime-phone',name:'Prime Phone Hub',category:'Electronics',description:'Phones, accessories and device support.',phone:'+234 801 000 0003',whatsapp:'+234 801 000 0003',city:'Abuja',featured:false},
{id:'bright-events',name:'Bright Events',category:'Services',description:'Event planning, rentals and professional event services.',phone:'+234 801 000 0004',whatsapp:'+234 801 000 0004',city:'Lagos',featured:false}];
