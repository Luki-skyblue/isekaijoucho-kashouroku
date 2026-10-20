import Link from 'next/link';
export default function NotFound(){return <section className="panel"><h1>ページが見つかりません</h1><p>対象が登録されていないか、URLが正しくありません。</p><Link href="/songs">楽曲一覧へ戻る →</Link></section>}
