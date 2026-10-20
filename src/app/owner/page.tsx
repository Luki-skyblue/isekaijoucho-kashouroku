import 'server-only';
import type {Metadata} from 'next';
import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import {ownerPageEnabled} from '@/lib/catalog-owner-gateway.mjs';
import {OwnerEditor} from '@/components/owner-editor';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const metadata:Metadata={title:'草稿の管理',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function OwnerPage(){
  if(!ownerPageEnabled(await headers()))notFound();
  const project=process.env.CATALOG_OWNER_PROJECT_REF;
  if(!project||!/^[a-z0-9-]+$/.test(project))return <p role="alert">接続先が未設定です。管理画面の起動設定を確認してください。</p>;
  return <OwnerEditor project={project}/>;
}
