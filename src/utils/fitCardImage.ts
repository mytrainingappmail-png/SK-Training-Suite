// Every card picture (Induction days and cards, Projects, Courses, Learning paths, part cards...) is fitted to the card's own
// shape the moment it is chosen, so nobody has to crop or resize anything:
//   * the card shape is 16:9 (1280 x 720 at most - sharp on every phone, even at 2x);
//   * a picture that is already close to 16:9 (up to a 3:2 photo or a 2:1 banner) fills the card, trimming only a sliver;
//   * any other shape (square, portrait, 4:3 poster) is shown WHOLE on a soft blurred copy of itself, so no text is cut off;
//   * it is saved as WebP (about 70-90% smaller than a camera JPEG / PNG) - the same sharpness at a fraction of the size.
// GIFs and SVGs, and anything the browser cannot read, are left exactly as they are.

export const CARD_PICTURE_WIDTH = 1280;
export const CARD_PICTURE_HEIGHT = 720;
const TARGET = CARD_PICTURE_WIDTH / CARD_PICTURE_HEIGHT;
const FILL_TOLERANCE = 0.18;   // how far from 16:9 a picture may be and still fill the card
const QUALITY = 0.86;

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function fitCardImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || /gif|svg/i.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const sw = bmp.width;
    const sh = bmp.height;
    if (!sw || !sh) { bmp.close(); return file; }
    const aspect = sw / sh;

    // never make a small picture bigger than it is (that adds size, not sharpness)
    const outW = Math.min(CARD_PICTURE_WIDTH, Math.max(640, Math.round(Math.max(sw, sh * TARGET))));
    const outH = Math.round(outW / TARGET);
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bmp.close(); return file; }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (Math.abs(aspect / TARGET - 1) <= FILL_TOLERANCE) {
      const scale = Math.max(outW / sw, outH / sh);
      const dw = sw * scale;
      const dh = sh * scale;
      ctx.drawImage(bmp, (outW - dw) / 2, (outH - dh) / 2, dw, dh);
    } else {
      // a soft blurred copy fills the sides, then the whole picture sits on top
      const tiny = document.createElement('canvas');
      tiny.width = 32;
      tiny.height = Math.max(2, Math.round(32 / TARGET));
      const tctx = tiny.getContext('2d');
      if (tctx) {
        const cs = Math.max(tiny.width / sw, tiny.height / sh);
        tctx.drawImage(bmp, (tiny.width - sw * cs) / 2, (tiny.height - sh * cs) / 2, sw * cs, sh * cs);
        ctx.drawImage(tiny, 0, 0, outW, outH);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(0, 0, outW, outH);
      }
      const s = Math.min(outW / sw, outH / sh);
      ctx.drawImage(bmp, (outW - sw * s) / 2, (outH - sh * s) / 2, sw * s, sh * s);
    }
    bmp.close();

    let blob = await toBlob(canvas, 'image/webp', QUALITY);
    let ext = 'webp';
    if (!blob || blob.type !== 'image/webp') { blob = await toBlob(canvas, 'image/jpeg', 0.88); ext = 'jpg'; }
    if (!blob) return file;

    // a picture that already fits and is already smaller than what we would make is left alone
    const alreadyFits = Math.abs(aspect / TARGET - 1) < 0.02 && sw <= CARD_PICTURE_WIDTH && /jpeg|webp/i.test(file.type);
    if (alreadyFits && file.size <= blob.size) return file;

    const base = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 60) || 'picture';
    return new File([blob], `${base}.${ext}`, { type: blob.type });
  } catch {
    return file;
  }
}
