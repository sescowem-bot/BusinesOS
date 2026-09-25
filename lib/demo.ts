import {Customer,Expense,Order,Product} from './types';
export const demoBusiness={id:'demo-business',name:'Demo Business',category:'Retail',currency:'NGN',ownerName:'Business Owner'};
export const customers:Customer[]=[
{id:'c1',name:'Sarah Johnson',phone:'+2348012345678',email:'sarah@example.com',orders:14,total:850000,paid:700000,balance:150000,status:'VIP'},
{id:'c2',name:'Daniel Ade',phone:'+2348098765432',orders:8,total:420000,paid:320000,balance:100000,status:'Owing'},
{id:'c3',name:'Mariam Bello',phone:'+2348076543210',orders:5,total:215000,paid:215000,balance:0,status:'Regular'},
{id:'c4',name:'Tunde Works',phone:'+2348034567890',orders:3,total:180000,paid:120000,balance:60000,status:'Owing'}];
export const products:Product[]=[
{id:'p1',name:'Premium Sneakers',sku:'SNK-001',price:120000,cost:85000,stock:12,minStock:5,category:'Fashion'},
{id:'p2',name:'Senator Fabric',sku:'FAB-014',price:85000,cost:50000,stock:3,minStock:5,category:'Fashion'},
{id:'p3',name:'Leather Belt',sku:'BLT-009',price:25000,cost:13000,stock:22,minStock:5,category:'Accessories'},
{id:'p4',name:'Classic Shirt',sku:'SHT-031',price:45000,cost:25000,stock:7,minStock:5,category:'Fashion'}];
export const orders:Order[]=[
{id:'ORD-1023',customer:'Sarah Johnson',total:150000,paid:100000,balance:50000,status:'processing',date:'2026-09-25'},
{id:'ORD-1022',customer:'Daniel Ade',total:240000,paid:140000,balance:100000,status:'confirmed',date:'2026-09-25'},
{id:'ORD-1021',customer:'Mariam Bello',total:85000,paid:85000,balance:0,status:'completed',date:'2026-09-24'},
{id:'ORD-1020',customer:'Tunde Works',total:120000,paid:60000,balance:60000,status:'ready',date:'2026-09-24'}];
export const expenses:Expense[]=[
{id:'e1',category:'Transport',description:'Deliveries',amount:28000,date:'2026-09-25'},
{id:'e2',category:'Marketing',description:'Social media promotion',amount:25000,date:'2026-09-23'},
{id:'e3',category:'Electricity',description:'Shop electricity',amount:18000,date:'2026-09-20'},
{id:'e4',category:'Packaging',description:'Bags and boxes',amount:12000,date:'2026-09-18'}];
export function metrics(){const sales=orders.filter(o=>o.status!=='cancelled').reduce((a,o)=>a+o.total,0)+4865000;const paid=orders.reduce((a,o)=>a+o.paid,0)+4100000;const outstanding=customers.reduce((a,c)=>a+c.balance,0);const expense=expenses.reduce((a,e)=>a+e.amount,0)+320000;const cogs=3150000;return {sales,paid,outstanding,expense,cogs,grossProfit:sales-cogs,profit:sales-cogs-expense,margin:(sales-cogs-expense)/sales*100}}
