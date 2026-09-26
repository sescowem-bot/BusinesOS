'use client';
import {TablePage} from '@/components/table-page';import {expenses} from '@/lib/demo';import {money} from '@/lib/format';
export default function Expenses(){return <TablePage title="Expenses" description="Track the money your business spends and understand where it goes." rows={expenses} addLabel="Add expense" columns={[{key:'date',label:'Date'},{key:'category',label:'Category'},{key:'description',label:'Description'},{key:'amount',label:'Amount',render:v=>money(Number(v))}]}/>}
