'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

/** Presentation-only themes. Outfit colors/images are provisional pending artwork review. */
const THEMES = [
  { id: 'sunflower', label: 'Sunflower', japanese: 'ひまわり' },
  { id: 'nemophila', label: 'Nemophila', japanese: 'ネモフィラ' },
  { id: 'anemone', label: 'Anemone', japanese: 'アネモネ' },
] as const;
type ThemeId = (typeof THEMES)[number]['id'];
const THEME_STORAGE_KEY = 'kashouroku-design-theme-v1';

const LINKS = [
  { href: '/songs', label: '楽曲一覧', en: 'SONGS' },
  { href: '/lives', label: 'LIVE一覧', en: 'LIVE' },
  { href: '/releases', label: '収録作品', en: 'RELEASES' },
  { href: '/discover', label: '公開・収録先から探す', en: 'DISCOVER' },
  { href: '/guide', label: '使い方', en: 'GUIDE' },
  { href: '/about', label: 'このサイトについて', en: 'ABOUT' },
  { href: '/contribute', label: '情報提供・訂正', en: 'SUBMIT INFO' },
] as const;

function isTheme(value: string | null): value is ThemeId {
  return THEMES.some(({ id }) => id === value);
}

export default function SiteControls() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>('sunflower');
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (isTheme(stored)) {
        setTheme(stored);
        document.documentElement.dataset.theme = stored;
      }
    } catch {
      // Storage may be blocked; the default theme is usable without storage.
    }
  }, []);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapRef.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const selectTheme = (next: ThemeId) => {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { window.localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* Optional */ }
  };

  return <div className="site-controls" ref={wrapRef}>
    <button ref={buttonRef} type="button" className="menu-trigger" aria-label={open ? 'メニューを閉じる' : 'メニューを開く'} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(v => !v)}>
      <span className="menu-lines" aria-hidden="true"><i /><i /><i /></span>
      <span className="menu-word">MENU</span>
    </button>
    {open && <div className="menu-panel" id={panelId}>
      <p className="menu-section-caption">ページ</p>
      <nav aria-label="サイト内メニュー" className="drawer-links">
        {LINKS.map(({ href, label, en }) => <Link key={href} href={href} aria-current={path === href ? 'page' : undefined} onClick={() => setOpen(false)}>
          <span>{label}</span><small>{en}</small>
        </Link>)}
      </nav>
      <div className="drawer-theme">
        <p className="menu-section-caption">衣装テーマ</p>
        <div className="theme-options" role="group" aria-label="衣装テーマを選ぶ">
          {THEMES.map(({ id, label, japanese }) => <button key={id} type="button" className="theme-option" aria-pressed={theme === id} onClick={() => selectTheme(id)}>
            <span className={`theme-dot theme-dot-${id}`} aria-hidden="true" />
            <span><strong>{label}</strong><small>{japanese}</small></span>
          </button>)}
        </div>
        <p className="theme-help">配色を切り替えます。</p>
      </div>
    </div>}
  </div>;
}
