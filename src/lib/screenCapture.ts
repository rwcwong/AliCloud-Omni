function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function timestampString(date: Date): string {
  const yy = String(date.getFullYear()).slice(-2);
  return `${yy}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function sanitizeCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9-_]/g, '_') || 'UNKNOWN';
}

export function formatDeviceCode(code: string): string {
  // Normalize hyphens to underscores, then collapse: keep first separator, remove the rest
  // e.g. "SD-BF-01" -> "SD_BF_01" -> "SD_BF01"
  const normalized = sanitizeCode(code).replace(/-/g, '_');
  const parts = normalized.split('_').filter(Boolean);
  if (parts.length <= 1) return normalized;
  return parts[0] + '_' + parts.slice(1).join('');
}

export function buildScreenshotFilename(deviceCode: string): string {
  const ts = timestampString(new Date());
  return `${formatDeviceCode(deviceCode)}_${ts}.png`;
}

export function buildBatchScreenshotFilename(): string {
  const ts = timestampString(new Date());
  return `MULTI-DISPATCH_${ts}.png`;
}

export interface ScreenshotResult {
  success: boolean;
  method: 'screen' | 'dom' | 'none';
  error?: string;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function captureViaDom(): Promise<Blob> {
  const target = document.querySelector('[data-screenshot-target]') as HTMLElement | null
    || document.querySelector('.floor-plan-container') as HTMLElement | null
    || document.querySelector('main') as HTMLElement | null
    || document.body;

  const rect = target.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));

  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  ctx.scale(scale, scale);
  ctx.fillStyle = '#020d25';
  ctx.fillRect(0, 0, w, h);

  const foreignObjectHtml = target.outerHTML;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <foreignObject width="100%" height="100%">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px;overflow:hidden;">
        ${foreignObjectHtml}
      </div>
    </foreignObject>
  </svg>`;

  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('DOM screenshot render failed'));
      img.src = url;
    });

    ctx.drawImage(img, 0, 0);

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/png'),
    );
    if (!blob) throw new Error('Failed to generate DOM screenshot');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function captureScreenshot(filename: string): Promise<ScreenshotResult> {
  try {
    const blob = await captureViaDom();
    downloadBlob(blob, filename);
    return { success: true, method: 'dom' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, method: 'none', error: msg };
  }
}
