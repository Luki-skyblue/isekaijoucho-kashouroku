'use client';
export default function Error({reset}:{error:Error & {digest?:string};reset:()=>void}){return <section className="panel"><h1>情報を取得できませんでした</h1><p>接続設定・公開API・ネットワークの状態を確認してください。内部エラーの詳細はこの画面には表示しません。</p><button onClick={()=>reset()}>再試行</button></section>}
