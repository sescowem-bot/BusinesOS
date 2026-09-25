export type OrderStatus='new'|'confirmed'|'processing'|'ready'|'delivered'|'completed'|'cancelled';
export type PaymentMethod='cash'|'transfer'|'pos'|'card'|'online'|'other';
export type DemoBusiness={id:string;name:string;category:string;currency:string;ownerName:string};
export type Customer={id:string;name:string;phone:string;email?:string;orders:number;total:number;paid:number;balance:number;status:string};
export type Product={id:string;name:string;sku:string;price:number;cost:number;stock:number;minStock:number;category:string};
export type Order={id:string;customer:string;total:number;paid:number;balance:number;status:OrderStatus;date:string};
export type Expense={id:string;category:string;description:string;amount:number;date:string};
