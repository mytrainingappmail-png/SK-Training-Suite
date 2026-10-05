// How a brochure's "Download" button should behave:
//  * a file uploaded to our storage  -> downloads straight away (the storage address is told to send it as a download,
//    because the browser ignores the plain `download` attribute for files on another address)
//  * any other link (Google Drive, …) -> opens that link in a new tab, where the person can view / download it there

export interface BrochureLink {
  href: string;
  /** true = a stored file that downloads directly; false = an outside link that opens in a new tab. */
  direct: boolean;
  /** suggested file name for a direct download */
  fileName: string;
}

export function brochureLink(url: string, title?: string): BrochureLink {
  const stored = /\/storage\/v1\/object\/public\//.test(url);
  const ext = (url.split('?')[0].split('.').pop() ?? '').toLowerCase();
  const base = (title ?? '').trim().replace(/[\\/:*?"<>|]+/g, '-') || 'brochure';
  const fileName = ext && ext.length <= 5 && !base.toLowerCase().endsWith(`.${ext}`) ? `${base}.${ext}` : base;
  if (!stored) return { href: url, direct: false, fileName };
  return { href: `${url}${url.includes('?') ? '&' : '?'}download=${encodeURIComponent(fileName)}`, direct: true, fileName };
}
