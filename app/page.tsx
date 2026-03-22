'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import jsPDF from 'jspdf';

type Step = 1 | 2 | 3 | 4;
type SheetSize = '4x6' | 'a4';

interface PhotoConfig {
  sheetSize: SheetSize;
  photoCount: number;
  bgColor: string;
}

interface CropArea {
  x: number; y: number; w: number; h: number;
}

const LAYOUTS = {
  '4x6': { cols: 3, rows: 3, perSheet: 9,  label: '4×6 inch', sublabel: '3×3 grid · 9 photos/sheet' },
  'a4':  { cols: 4, rows: 5, perSheet: 20, label: 'A4',        sublabel: '4×5 grid · up to 20/sheet' },
};

const QTY_OPTIONS: Record<SheetSize, number[]> = {
  '4x6': [3, 6, 9],
  'a4':  [5, 10, 15],
};

// ─── Step Indicator ──────────────────────────────────────────────────────────
function StepBar({ current }: { current: Step }) {
  const steps = [
    { n: 1, label: 'Upload' },
    { n: 2, label: 'Remove BG' },
    { n: 3, label: 'Layout' },
    { n: 4, label: 'Download' },
  ];
  return (
    <div className="flex items-center justify-center gap-0 mb-10 w-full max-w-2xl mx-auto">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-1">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
              current === s.n ? 'step-active' : current > s.n ? 'step-done' : 'step-pending'
            }`}>
              {current > s.n ? '✓' : s.n}
            </div>
            <span className={`text-xs mt-1 font-medium ${current >= s.n ? 'text-blue-400' : 'text-gray-500'}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px flex-1 mb-4 transition-all duration-500 ${current > s.n ? 'bg-blue-500' : 'bg-gray-700'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Crop Tool (pure canvas, no library needed) ───────────────────────────────
function CropTool({ imageUrl, onCropDone, onSkip }: {
  imageUrl: string;
  onCropDone: (croppedUrl: string) => void;
  onSkip: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Crop box state (in display pixels)
  const [crop, setCrop] = useState<CropArea>({ x: 50, y: 30, w: 200, h: 257 }); // ~35:45 ratio
  const [dragging, setDragging] = useState<null | 'move' | 'tl' | 'tr' | 'bl' | 'br'>(null);
  const [dragStart, setDragStart] = useState({ mx: 0, my: 0, cx: 0, cy: 0, cw: 0, ch: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0, offX: 0, offY: 0 });
  const [naturalSize, setNaturalSize] = useState({ w: 1, h: 1 });

  const PASSPORT_RATIO = 35 / 45; // width/height

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });

      const container = containerRef.current;
      if (!container) return;
      const maxW = Math.min(container.clientWidth - 32, 480);
      const maxH = 420;
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
      const dw = Math.round(img.naturalWidth * scale);
      const dh = Math.round(img.naturalHeight * scale);
      const offX = Math.round((maxW - dw) / 2);
      setDisplaySize({ w: dw, h: dh, offX, offY: 0 });

      // Default crop: center, passport ratio, 60% height
      const ch = Math.round(dh * 0.65);
      const cw = Math.round(ch * PASSPORT_RATIO);
      const cx = Math.round((dw - cw) / 2) + offX;
      const cy = Math.round((dh - ch) / 2);
      setCrop({ x: cx, y: cy, w: cw, h: ch });
      setImgLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Draw on canvas
  useEffect(() => {
    if (!imgLoaded || !canvasRef.current || !imgRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const { w: dw, h: dh, offX } = displaySize;

    canvas.width = dw + offX * 2;
    canvas.height = dh;

    // Draw image
    ctx.drawImage(imgRef.current, offX, 0, dw, dh);

    // Dark overlay outside crop
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.clearRect(crop.x, crop.y, crop.w, crop.h);
    ctx.drawImage(imgRef.current, offX, 0, dw, dh);
    // Redraw only crop region
    ctx.save();
    ctx.beginPath();
    ctx.rect(crop.x, crop.y, crop.w, crop.h);
    ctx.clip();
    ctx.drawImage(imgRef.current, offX, 0, dw, dh);
    ctx.restore();

    // Crop border
    ctx.strokeStyle = '#4f8aff';
    ctx.lineWidth = 2;
    ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);

    // Rule of thirds grid
    ctx.strokeStyle = 'rgba(79,138,255,0.3)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(crop.x + (crop.w / 3) * i, crop.y);
      ctx.lineTo(crop.x + (crop.w / 3) * i, crop.y + crop.h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(crop.x, crop.y + (crop.h / 3) * i);
      ctx.lineTo(crop.x + crop.w, crop.y + (crop.h / 3) * i);
      ctx.stroke();
    }

    // Corner handles
    const hs = 10;
    ctx.fillStyle = '#4f8aff';
    const corners = [
      [crop.x, crop.y],
      [crop.x + crop.w - hs, crop.y],
      [crop.x, crop.y + crop.h - hs],
      [crop.x + crop.w - hs, crop.y + crop.h - hs],
    ];
    corners.forEach(([cx, cy]) => {
      ctx.fillRect(cx, cy, hs, hs);
    });

    // Size label
    const scaleX = naturalSize.w / displaySize.w;
    const scaleY = naturalSize.h / displaySize.h;
    const realW = Math.round(crop.w * scaleX);
    const realH = Math.round(crop.h * scaleY);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(crop.x, crop.y + crop.h + 4, 90, 18);
    ctx.fillStyle = '#4f8aff';
    ctx.font = '11px monospace';
    ctx.fillText(`${realW}×${realH}px`, crop.x + 4, crop.y + crop.h + 16);

  }, [crop, imgLoaded, displaySize, naturalSize]);

  // Mouse/touch helpers
  const getPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const getHandle = (mx: number, my: number): typeof dragging => {
    const hs = 16;
    const { x, y, w, h } = crop;
    if (mx >= x && mx <= x + hs && my >= y && my <= y + hs) return 'tl';
    if (mx >= x + w - hs && mx <= x + w && my >= y && my <= y + hs) return 'tr';
    if (mx >= x && mx <= x + hs && my >= y + h - hs && my <= y + h) return 'bl';
    if (mx >= x + w - hs && mx <= x + w && my >= y + h - hs && my <= y + h) return 'br';
    if (mx >= x && mx <= x + w && my >= y && my <= y + h) return 'move';
    return null;
  };

  const onMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    const { x: mx, y: my } = getPos(e);
    const handle = getHandle(mx, my);
    if (handle) {
      setDragging(handle);
      setDragStart({ mx, my, cx: crop.x, cy: crop.y, cw: crop.w, ch: crop.h });
    }
  };

  const onMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragging) return;
    const { x: mx, y: my } = getPos(e);
    const dx = mx - dragStart.mx;
    const dy = my - dragStart.my;
    const { cx, cy, cw, ch } = dragStart;
    const canvasW = canvasRef.current!.width;
    const canvasH = canvasRef.current!.height;
    const minSize = 60;

    if (dragging === 'move') {
      setCrop(c => ({
        ...c,
        x: Math.max(0, Math.min(canvasW - cw, cx + dx)),
        y: Math.max(0, Math.min(canvasH - ch, cy + dy)),
      }));
    } else if (dragging === 'br') {
      // Keep passport ratio on resize
      const newW = Math.max(minSize, cw + dx);
      const newH = Math.round(newW / PASSPORT_RATIO);
      setCrop(c => ({ ...c, w: newW, h: newH }));
    } else if (dragging === 'tl') {
      const newW = Math.max(minSize, cw - dx);
      const newH = Math.round(newW / PASSPORT_RATIO);
      setCrop(c => ({ ...c, x: cx + cw - newW, y: cy + ch - newH, w: newW, h: newH }));
    } else if (dragging === 'tr') {
      const newW = Math.max(minSize, cw + dx);
      const newH = Math.round(newW / PASSPORT_RATIO);
      setCrop(c => ({ ...c, y: cy + ch - newH, w: newW, h: newH }));
    } else if (dragging === 'bl') {
      const newW = Math.max(minSize, cw - dx);
      const newH = Math.round(newW / PASSPORT_RATIO);
      setCrop(c => ({ ...c, x: cx + cw - newW, w: newW, h: newH }));
    }
  };

  const onMouseUp = () => setDragging(null);

  const applyCrop = () => {
    if (!imgRef.current) return;
    const outCanvas = document.createElement('canvas');
    // Output at passport ratio, high res
    const outW = 350;
    const outH = 450;
    outCanvas.width = outW;
    outCanvas.height = outH;
    const ctx = outCanvas.getContext('2d')!;

    // Map crop display coords → natural image coords
    const scaleX = naturalSize.w / displaySize.w;
    const scaleY = naturalSize.h / displaySize.h;
    const srcX = (crop.x - displaySize.offX) * scaleX;
    const srcY = crop.y * scaleY;
    const srcW = crop.w * scaleX;
    const srcH = crop.h * scaleY;

    ctx.drawImage(imgRef.current, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
    onCropDone(outCanvas.toDataURL('image/jpeg', 0.95));
  };

  return (
    <div className="fade-in flex flex-col items-center w-full" ref={containerRef}>
      <h2 className="text-3xl font-bold mb-1" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '2px' }}>
        CROP YOUR PHOTO
      </h2>
      <p className="text-gray-400 mb-5 text-center text-sm">
        Drag the box to frame your face. Corners resize (passport 35:45 ratio locked).
      </p>

      {!imgLoaded ? (
        <div className="flex items-center justify-center h-64">
          <div className="loader" />
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          className="rounded-xl border border-gray-700 touch-none"
          style={{ maxWidth: '100%', cursor: dragging ? 'grabbing' : 'crosshair' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onMouseDown}
          onTouchMove={onMouseMove}
          onTouchEnd={onMouseUp}
        />
      )}

      <div className="flex gap-3 mt-6 flex-wrap justify-center">
        <button className="btn-secondary" onClick={onSkip}>Skip Crop</button>
        <button className="btn-primary flex items-center gap-2" onClick={applyCrop} disabled={!imgLoaded}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M6 2v14h14M2 6h14"/>
          </svg>
          Apply Crop →
        </button>
      </div>

      <p className="text-xs text-gray-600 mt-3 text-center">
        Blue box = passport photo area · Drag to move · Drag corners to resize
      </p>
    </div>
  );
}

// ─── Step 1: Upload + Crop ────────────────────────────────────────────────────
function Step1Upload({ onUpload }: { onUpload: (url: string) => void }) {
  const [rawUrl, setRawUrl] = useState('');
  const [showCrop, setShowCrop] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      const url = URL.createObjectURL(accepted[0]);
      setRawUrl(url);
      setShowCrop(true);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
  });

  if (showCrop && rawUrl) {
    return (
      <CropTool
        imageUrl={rawUrl}
        onCropDone={(croppedUrl) => onUpload(croppedUrl)}
        onSkip={() => onUpload(rawUrl)}
      />
    );
  }

  return (
    <div className="fade-in flex flex-col items-center">
      <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '2px' }}>
        UPLOAD YOUR PHOTO
      </h2>
      <p className="text-gray-400 mb-8 text-center">Clear front-facing photo works best. JPG, PNG, WEBP supported.</p>

      <div
        {...getRootProps()}
        className={`dropzone w-full max-w-md h-64 rounded-2xl flex flex-col items-center justify-center gap-4 transition-all ${isDragActive ? 'active' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
          <svg width="28" height="28" fill="none" stroke="#4f8aff" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
          </svg>
        </div>
        <div className="text-center">
          <p className="text-white font-semibold">Drop your photo here</p>
          <p className="text-gray-500 text-sm mt-1">or click to browse files</p>
        </div>
      </div>

      <div className="mt-6 glass-card px-5 py-3 flex items-center gap-3 max-w-md w-full">
        <span className="text-xl">✂️</span>
        <p className="text-xs text-gray-400">Upload ke baad <span className="text-blue-400 font-semibold">crop tool</span> khulega — face frame karke perfect passport size banao</p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 w-full max-w-md">
        {['Front-facing', 'Good lighting', 'Plain background'].map(tip => (
          <div key={tip} className="glass-card p-3 text-center">
            <p className="text-xs text-gray-400">{tip}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: Remove Background ───────────────────────────────────────────────
function Step2RemoveBg({
  originalUrl,
  onDone,
  onBack,
}: {
  originalUrl: string;
  onDone: (result: string) => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const [bgColor, setBgColor] = useState('#ffffff');

  const removeBg = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(originalUrl);
      const blob = await res.blob();
      const formData = new FormData();
      formData.append('image_file', blob, 'photo.png');
      const apiRes = await fetch('/api/remove-bg', { method: 'POST', body: formData });
      const data = await apiRes.json();
      if (!apiRes.ok) throw new Error(data.error || 'Failed');
      setPreview(data.result);
    } catch (e: any) {
      setError(e.message || 'Background removal failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in flex flex-col items-center">
      <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '2px' }}>
        REMOVE BACKGROUND
      </h2>
      <p className="text-gray-400 mb-8 text-center">Use Remove.bg AI to get a clean passport background.</p>

      <div className="flex gap-6 mb-8 flex-wrap justify-center">
        <div className="glass-card p-4 flex flex-col items-center gap-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Cropped Photo</p>
          <img src={originalUrl} alt="Original" className="w-36 h-44 object-cover rounded-lg" />
        </div>
        <div className="glass-card p-4 flex flex-col items-center gap-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider">BG Removed</p>
          <div className="w-36 h-44 rounded-lg flex items-center justify-center overflow-hidden"
            style={{ background: preview ? bgColor : '#1a1a24' }}>
            {preview
              ? <img src={preview} alt="No BG" className="w-full h-full object-cover" />
              : <p className="text-gray-600 text-xs text-center px-2">Click button below</p>}
          </div>
          {preview && (
            <div className="flex items-center gap-2 mt-1">
              <label className="text-xs text-gray-400">BG:</label>
              <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
              <div onClick={() => setBgColor('#ffffff')}
                className="w-8 h-8 rounded border border-gray-600 cursor-pointer flex items-center justify-center text-xs"
                style={{ background: '#fff', color: '#000' }}>W</div>
              <div onClick={() => setBgColor('#e8f4f8')}
                className="w-8 h-8 rounded border border-gray-600 cursor-pointer"
                style={{ background: '#e8f4f8' }} />
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm max-w-sm text-center">
          {error}
        </div>
      )}

      <div className="flex gap-3 flex-wrap justify-center">
        <button className="btn-secondary" onClick={onBack}>← Back</button>
        {!preview
          ? <button className="btn-primary" onClick={removeBg} disabled={loading}>
              {loading
                ? <span className="flex items-center gap-2">
                    <span style={{display:'inline-block',width:16,height:16,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',animation:'spin 0.8s linear infinite'}}/>
                    Removing...
                  </span>
                : '✨ Remove Background'}
            </button>
          : <button className="btn-primary" onClick={() => onDone(preview)}>Use This Photo →</button>}
        <button className="btn-secondary" onClick={() => onDone(originalUrl)}>Skip (keep original)</button>
      </div>
    </div>
  );
}

// ─── Step 3: Layout & Quantity ────────────────────────────────────────────────
function Step3Layout({ photoUrl, config, setConfig, onNext, onBack }: {
  photoUrl: string;
  config: PhotoConfig;
  setConfig: (c: PhotoConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const layout = LAYOUTS[config.sheetSize];
  const qtyOptions = QTY_OPTIONS[config.sheetSize];
  const sheetsNeeded = Math.ceil(config.photoCount / layout.perSheet);
  const isA4 = config.sheetSize === 'a4';
  const cellW = isA4 ? 42 : 48;
  const cellH = isA4 ? 54 : 58;

  return (
    <div className="fade-in flex flex-col items-center w-full">
      <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '2px' }}>
        LAYOUT & QUANTITY
      </h2>
      <p className="text-gray-400 mb-8 text-center">Choose sheet size and total number of passport photos.</p>

      <div className="w-full max-w-2xl grid md:grid-cols-2 gap-8">
        <div className="flex flex-col gap-6">
          {/* Sheet Size */}
          <div>
            <p className="text-sm text-gray-400 mb-3 uppercase tracking-wider font-medium">Sheet Size</p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(LAYOUTS) as [SheetSize, typeof LAYOUTS['4x6']][]).map(([key, val]) => (
                <div key={key}
                  className={`size-card cursor-pointer ${config.sheetSize === key ? 'selected' : ''}`}
                  onClick={() => setConfig({ ...config, sheetSize: key, photoCount: QTY_OPTIONS[key][0] })}>
                  <div className={`size-icon text-2xl mb-1 ${config.sheetSize === key ? 'text-blue-400' : 'text-gray-500'}`}>
                    {key === '4x6' ? '🖼' : '📄'}
                  </div>
                  <p className="font-semibold text-sm">{val.label}</p>
                  <p className="text-xs text-gray-500">{val.sublabel}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div>
            <p className="text-sm text-gray-400 mb-3 uppercase tracking-wider font-medium">Number of Photos</p>
            <div className="flex gap-3">
              {qtyOptions.map(qty => (
                <button key={qty} onClick={() => setConfig({ ...config, photoCount: qty })}
                  className="flex-1 py-3 rounded-xl font-bold text-lg transition-all duration-200"
                  style={{
                    background: config.photoCount === qty ? 'linear-gradient(135deg, #4f8aff, #a855f7)' : 'var(--surface)',
                    color: config.photoCount === qty ? 'white' : 'var(--muted)',
                    border: config.photoCount === qty ? '2px solid transparent' : '2px solid var(--border)',
                    boxShadow: config.photoCount === qty ? '0 4px 16px rgba(79,138,255,0.35)' : 'none',
                    transform: config.photoCount === qty ? 'scale(1.05)' : 'scale(1)',
                  }}>
                  {qty}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-2">
              = {sheetsNeeded} sheet{sheetsNeeded > 1 ? 's' : ''} · {config.photoCount} passport photos
            </p>
          </div>

          {/* Background */}
          <div>
            <p className="text-sm text-gray-400 mb-3 uppercase tracking-wider font-medium">Background Color</p>
            <div className="flex gap-2 flex-wrap">
              {['#ffffff', '#f0f0f0', '#e8f4f8', '#d4e8d4', '#fde8e8'].map(c => (
                <div key={c}
                  className={`w-9 h-9 rounded-lg cursor-pointer border-2 transition-all ${config.bgColor === c ? 'border-blue-400 scale-110' : 'border-gray-600'}`}
                  style={{ background: c }}
                  onClick={() => setConfig({ ...config, bgColor: c })} />
              ))}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-gray-400 uppercase tracking-wider font-medium">Sheet Preview</p>
          <div className="rounded-xl overflow-hidden shadow-lg border border-gray-700"
            style={{
              background: config.bgColor,
              display: 'grid',
              gridTemplateColumns: `repeat(${layout.cols}, ${cellW}px)`,
              gap: '4px', padding: '8px',
            }}>
            {Array.from({ length: layout.perSheet }).map((_, i) => (
              <div key={i} style={{
                width: cellW, height: cellH, overflow: 'hidden', borderRadius: '3px',
                opacity: i < config.photoCount ? 1 : 0.15,
                border: i < config.photoCount ? 'none' : '1px dashed #444',
              }}>
                {i < config.photoCount
                  ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                  : <div style={{ width: '100%', height: '100%', background: '#2a2a3a' }} />}
              </div>
            ))}
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">
              <span className="text-blue-400 font-semibold">{config.photoCount}</span> photos
              <span className="text-gray-600"> / {layout.perSheet} slots</span>
            </p>
            <p className="text-xs text-gray-600">{layout.cols}×{layout.rows} grid · {LAYOUTS[config.sheetSize].label}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-8">
        <button className="btn-secondary" onClick={onBack}>← Back</button>
        <button className="btn-primary" onClick={onNext}>Generate Sheet →</button>
      </div>
    </div>
  );
}

// ─── Step 4: Download & Print ─────────────────────────────────────────────────
function Step4Download({ photoUrl, config, onBack, onRestart }: {
  photoUrl: string;
  config: PhotoConfig;
  onBack: () => void;
  onRestart: () => void;
}) {
  const layout = LAYOUTS[config.sheetSize];
  const [downloading, setDownloading] = useState(false);
  const sheetsNeeded = Math.ceil(config.photoCount / layout.perSheet);
  const isA4 = config.sheetSize === 'a4';
  const CELL_W = isA4 ? 42 : 48;
  const CELL_H = isA4 ? 54 : 58;

  const downloadPDF = async () => {
    setDownloading(true);
    try {
      const sheetW = config.sheetSize === '4x6' ? 101.6 : 210;
      const sheetH = config.sheetSize === '4x6' ? 152.4 : 297;
      const photoW = 35, photoH = 45;
      const gapX = (sheetW - layout.cols * photoW) / (layout.cols + 1);
      const gapY = (sheetH - layout.rows * photoH) / (layout.rows + 1);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise(res => { img.onload = res; img.src = photoUrl; });

      let remaining = config.photoCount;
      for (let s = 0; s < sheetsNeeded; s++) {
        const photosThisSheet = Math.min(remaining, layout.perSheet);
        remaining -= photosThisSheet;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [sheetW, sheetH] });
        pdf.setFillColor(config.bgColor);
        pdf.rect(0, 0, sheetW, sheetH, 'F');
        let count = 0;
        outer: for (let row = 0; row < layout.rows; row++) {
          for (let col = 0; col < layout.cols; col++) {
            if (count >= photosThisSheet) break outer;
            const x = gapX + col * (photoW + gapX);
            const y = gapY + row * (photoH + gapY);
            pdf.addImage(img, 'JPEG', x, y, photoW, photoH);
            count++;
          }
        }
        setTimeout(() => pdf.save(`passport-photos-${config.sheetSize}-sheet${s + 1}.pdf`), s * 350);
      }
      setTimeout(() => setDownloading(false), sheetsNeeded * 350 + 200);
    } catch (e) {
      console.error(e);
      alert('Download failed. Please try again.');
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const sheetW = config.sheetSize === '4x6' ? '4in' : '210mm';
    const sheetH = config.sheetSize === '4x6' ? '6in' : '297mm';
    const photoW = '35mm', photoH = '45mm';
    let remaining = config.photoCount;
    const sheets = Array.from({ length: sheetsNeeded }).map(() => {
      const photosThisSheet = Math.min(remaining, layout.perSheet);
      remaining -= photosThisSheet;
      const photos = Array.from({ length: photosThisSheet })
        .map(() => `<img src="${photoUrl}" style="width:${photoW};height:${photoH};object-fit:cover;object-position:top;display:block;" />`)
        .join('');
      return `<div class="sheet" style="width:${sheetW};height:${sheetH};background:${config.bgColor};display:grid;grid-template-columns:repeat(${layout.cols},${photoW});grid-template-rows:repeat(${layout.rows},${photoH});justify-content:center;align-content:center;gap:4mm;padding:6mm;page-break-after:always;box-sizing:border-box;">${photos}</div>`;
    }).join('');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Passport Photos</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:white;}@page{size:${sheetW} ${sheetH};margin:0;}@media print{.sheet{page-break-after:always;}}</style></head><body>${sheets}</body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="fade-in flex flex-col items-center w-full">
      <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center mb-4">
        <span className="text-2xl">✅</span>
      </div>
      <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '2px' }}>
        READY TO DOWNLOAD
      </h2>
      <p className="text-gray-400 mb-8 text-center">
        <span className="text-white font-semibold">{config.photoCount}</span> passport photos ·{' '}
        <span className="text-white font-semibold">{sheetsNeeded}</span> sheet{sheetsNeeded > 1 ? 's' : ''} · {layout.label}
      </p>

      {/* Previews */}
      <div className="flex flex-wrap justify-center gap-6 mb-10">
        {(() => {
          let rem = config.photoCount;
          return Array.from({ length: Math.min(sheetsNeeded, 3) }).map((_, si) => {
            const photosThisSheet = Math.min(rem, layout.perSheet);
            rem -= photosThisSheet;
            return (
              <div key={si} className="flex flex-col items-center gap-2">
                <div className="rounded-xl overflow-hidden shadow-xl border border-gray-600"
                  style={{ background: config.bgColor, display: 'grid', gridTemplateColumns: `repeat(${layout.cols}, ${CELL_W}px)`, gap: '4px', padding: '8px' }}>
                  {Array.from({ length: layout.perSheet }).map((_, i) => (
                    <div key={i} style={{ width: CELL_W, height: CELL_H, overflow: 'hidden', borderRadius: '2px', opacity: i < photosThisSheet ? 1 : 0.1 }}>
                      {i < photosThisSheet
                        ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                        : <div style={{ width: '100%', height: '100%', background: '#2a2a3a' }} />}
                    </div>
                  ))}
                </div>
                <span className="text-xs text-gray-500">Sheet {si + 1} · {photosThisSheet} photos</span>
              </div>
            );
          });
        })()}
        {sheetsNeeded > 3 && <div className="flex items-center text-gray-500 text-sm">+{sheetsNeeded - 3} more</div>}
      </div>

      <div className="flex flex-wrap gap-4 justify-center">
        <button className="btn-primary flex items-center gap-2 px-8 py-3" onClick={downloadPDF} disabled={downloading}>
          {downloading
            ? <><span style={{display:'inline-block',width:16,height:16,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',animation:'spin 0.8s linear infinite'}}/>Generating PDFs...</>
            : <><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>Download PDF{sheetsNeeded > 1 ? `s (${sheetsNeeded})` : ''}</>}
        </button>
        <button className="btn-secondary flex items-center gap-2 px-8 py-3" onClick={handlePrint}>
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>
          Print Directly
        </button>
      </div>

      <div className="flex gap-3 mt-8">
        <button className="btn-secondary" onClick={onBack}>← Edit Layout</button>
        <button className="btn-secondary" onClick={onRestart}>🔄 Start Over</button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [step, setStep] = useState<Step>(1);
  const [originalUrl, setOriginalUrl] = useState('');
  const [processedUrl, setProcessedUrl] = useState('');
  const [config, setConfig] = useState<PhotoConfig>({
    sheetSize: '4x6',
    photoCount: 3,
    bgColor: '#ffffff',
  });

  const handleUpload = (url: string) => {
    setOriginalUrl(url);
    setStep(2);
  };

  const handleBgDone = (result: string) => {
    setProcessedUrl(result);
    setStep(3);
  };

  const handleRestart = () => {
    setStep(1);
    setOriginalUrl('');
    setProcessedUrl('');
    setConfig({ sheetSize: '4x6', photoCount: 3, bgColor: '#ffffff' });
  };

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-10"
      style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #0f0f1a 50%, #0a0a0f 100%)' }}>
      <div className="text-center mb-10">
        <h1 className="text-5xl md:text-6xl font-black tracking-widest mb-2"
          style={{ fontFamily: 'Bebas Neue, sans-serif', background: 'linear-gradient(135deg, #4f8aff, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          PASSPORT PRO
        </h1>
        <p className="text-gray-500 text-sm tracking-wider uppercase">Instant Passport Photo Generator</p>
      </div>

      <StepBar current={step} />

      <div className="glass-card w-full max-w-3xl p-8 md:p-12">
        {step === 1 && <Step1Upload onUpload={handleUpload} />}
        {step === 2 && <Step2RemoveBg originalUrl={originalUrl} onDone={handleBgDone} onBack={() => setStep(1)} />}
        {step === 3 && <Step3Layout photoUrl={processedUrl} config={config} setConfig={setConfig} onNext={() => setStep(4)} onBack={() => setStep(2)} />}
        {step === 4 && <Step4Download photoUrl={processedUrl} config={config} onBack={() => setStep(3)} onRestart={handleRestart} />}
      </div>

      <p className="text-gray-700 text-xs mt-8 text-center">
        Passport photos 35×45mm · 4×6: 3×3 grid · A4: 4×5 grid · Powered by Remove.bg
      </p>
    </main>
  );
}
