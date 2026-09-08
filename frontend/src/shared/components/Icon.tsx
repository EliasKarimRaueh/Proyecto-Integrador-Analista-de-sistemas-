export type IconName = 'home' | 'box' | 'bag' | 'users' | 'key' | 'search' | 'plus' | 'edit' | 'eye' | 'close' | 'archive' | 'check' | 'arrow'
const paths: Record<IconName, string> = {
  home: 'm3 10 9-7 9 7v10H14v-7h-4v7H3Z',
  box: 'm3 7 9-4 9 4v10l-9 4-9-4Zm0 0 9 4 9-4M12 11v10M7 5l10 4',
  bag: 'M5 7h14l1 14H4ZM9 7V5a3 3 0 0 1 6 0v2',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 4a4 4 0 0 1 0 7M22 21v-2a4 4 0 0 0-3-4',
  key: 'M8 14a5 5 0 1 1 4-4L22 2M18 6l3 3M15 9l3 3',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  plus: 'M12 5v14M5 12h14',
  edit: 'm15 4 5 5M4 16l-1 5 5-1L21 7l-5-5Z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  close: 'm6 6 12 12M6 18 18 6',
  archive: 'M4 8h16v13H4ZM3 3h18v5H3ZM9 12h6',
  check: 'm5 12 4 4L19 6',
  arrow: 'm9 5 7 7-7 7',
}
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}

