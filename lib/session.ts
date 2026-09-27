'use client';
import {useEffect,useState,useCallback} from 'react';
import {getSupabaseBrowser} from './supabase';

export type Business={id:string;name:string;slug:string;category:string;description:string|null;phone:string|null;whatsapp:string|null;city:string|null;country:string;currency:string;published:boolean};

export function useBusiness(){
  const[business,setBusiness]=useState<Business|null>(null);
  const[userId,setUserId]=useState<string|null>(null);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    const supabase=getSupabaseBrowser();
    if(!supabase){setError('Supabase is not configured.');setLoading(false);return}
    setLoading(true);
    const{data:auth}=await supabase.auth.getUser();
    if(!auth.user){setUserId(null);setBusiness(null);setLoading(false);return}
    setUserId(auth.user.id);
    const{data:memberRow,error:memberErr}=await supabase.from('business_members').select('business_id').eq('user_id',auth.user.id).order('created_at',{ascending:true}).limit(1).maybeSingle();
    if(memberErr){setError(memberErr.message);setLoading(false);return}
    if(!memberRow){setBusiness(null);setLoading(false);return}
    const{data:biz,error:bizErr}=await supabase.from('businesses').select('id,name,slug,category,description,phone,whatsapp,city,country,currency,published').eq('id',memberRow.business_id).maybeSingle();
    if(bizErr){setError(bizErr.message);setLoading(false);return}
    setBusiness(biz as Business);
    setLoading(false);
  },[]);

  useEffect(()=>{load()},[load]);

  return{business,userId,loading,error,refresh:load};
}

export function nextOrderNumber(){return 'ORD-'+Date.now().toString(36).toUpperCase()}
export function nextQuoteNumber(){return 'QTE-'+Date.now().toString(36).toUpperCase()}
