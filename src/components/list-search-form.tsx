'use client';

import Form from 'next/form';
import {useEffect,useRef,type ReactNode} from 'react';

/** Keep the native GET fallback while submitting within the existing page.
 * The form and input stay mounted, retaining the user's focus. Synchronize an
 * old draft after a changed URL (clear/back/filter), without focusing a field
 * or overwriting text entered before hydration on the first mount.
 */
export function ListSearchForm({action,searchValue,resetKey,children,className='search'}:{
 action:'/songs'|'/lives'|'/releases'|'/people';searchValue:string;resetKey:string;children:ReactNode;className?:string;
}){
 const form=useRef<HTMLFormElement>(null),applied=useRef({searchValue,resetKey});
 useEffect(()=>{
  if(applied.current.searchValue===searchValue&&applied.current.resetKey===resetKey)return;
  applied.current={searchValue,resetKey};
  const input=form.current?.querySelector<HTMLInputElement>('input[name="q"]');
  if(input&&input.value!==searchValue)input.value=searchValue;
 },[searchValue,resetKey]);
 return <Form action={action} scroll={false} prefetch={false} ref={form} className={className}>{children}</Form>;
}
