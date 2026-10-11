'use client';
import {useState} from 'react';
export default function CopyInviteLink({id}:{id:string}){
 const [copied,setCopied]=useState(false);
 return <button type="button" className="btn" onClick={async()=>{try{await navigator.clipboard.writeText(`${window.location.origin}/invitation/${id}`);setCopied(true)}catch{setCopied(false)}}}>{copied?'Copied':'Copy link'}</button>;
}
