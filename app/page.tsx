'use client';

import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import jsPDF from 'jspdf';

type Step = 1 | 2 | 3 | 4;
type SheetSize = '4x6' | 'a4';

interface PhotoConfig {
  sheetSize: SheetSize;
  photoCount: number; // total photos user wants
  bgColor: string;
}

// 4x6: 3x3 = 9 photos per sheet
// A4: 4x5 = 20 max, but user picks 5/10/15
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

// ─── Step 1: Upload ──────────────────────────────────────────────────────────
function Step1Upload({ onUpload }: { onUpload: (file: File, url: string) => void }) {
  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      const url = URL.createObjectURL(accepted[0]);
      onUpload(accepted[0], url);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
  });

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

      <div className="mt-8 grid grid-cols-3 gap-4 w-full max-w-md">
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
          <p className="text-xs text-gray-500 uppercase tracking-wider">Original</p>
          <img src={originalUrl} alt="Original" className="w-36 h-44 object-cover rounded-lg" />
        </div>

        <div className="glass-card p-4 flex flex-col items-center gap-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider">BG Removed</p>
          <div
            className="w-36 h-44 rounded-lg flex items-center justify-center overflow-hidden"
            style={{ background: preview ? bgColor : '#1a1a24' }}
          >
            {preview ? (
              <img src={preview} alt="No BG" className="w-full h-full object-cover" />
            ) : (
              <p className="text-gray-600 text-xs text-center px-2">Click button below</p>
            )}
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
        {!preview ? (
          <button className="btn-primary" onClick={removeBg} disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span style={{display:'inline-block',width:16,height:16,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',animation:'spin 0.8s linear infinite'}}/>
                Removing...
              </span>
            ) : '✨ Remove Background'}
          </button>
        ) : (
          <button className="btn-primary" onClick={() => onDone(preview)}>Use This Photo →</button>
        )}
        <button className="btn-secondary" onClick={() => onDone(originalUrl)}>Skip (keep original)</button>
      </div>
    </div>
  );
}

// ─── Step 3: Layout & Quantity ────────────────────────────────────────────────
function Step3Layout({
  photoUrl,
  config,
  setConfig,
  onNext,
  onBack,
}: {
  photoUrl: string;
  config: PhotoConfig;
  setConfig: (c: PhotoConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const layout = LAYOUTS[config.sheetSize];
  const qtyOptions = QTY_OPTIONS[config.sheetSize];
  const sheetsNeeded = Math.ceil(config.photoCount / layout.perSheet);

  // Preview: show only as many photos as selected
  const previewCount = config.photoCount;
  const previewCols = layout.cols;
  // For preview grid, show full grid slots but grey out unused
  const totalSlots = layout.perSheet;

  // Preview dimensions
  const isA4 = config.sheetSize === 'a4';
  const previewW = isA4 ? 210 : 170;
  const cellW = isA4 ? 42 : 48;
  const cellH = isA4 ? 54 : 58;

  return (
    <div className="fade-in flex flex-col items-center w-full">
      <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '2px' }}>
        LAYOUT & QUANTITY
      </h2>
      <p className="text-gray-400 mb-8 text-center">Choose sheet size and total number of passport photos.</p>

      <div className="w-full max-w-2xl grid md:grid-cols-2 gap-8">
        {/* Left: Options */}
        <div className="flex flex-col gap-6">

          {/* Sheet Size */}
          <div>
            <p className="text-sm text-gray-400 mb-3 uppercase tracking-wider font-medium">Sheet Size</p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(LAYOUTS) as [SheetSize, typeof LAYOUTS['4x6']][]).map(([key, val]) => (
                <div
                  key={key}
                  className={`size-card cursor-pointer ${config.sheetSize === key ? 'selected' : ''}`}
                  onClick={() => {
                    const newQty = QTY_OPTIONS[key][0];
                    setConfig({ ...config, sheetSize: key, photoCount: newQty });
                  }}
                >
                  <div className={`size-icon text-2xl mb-1 ${config.sheetSize === key ? 'text-blue-400' : 'text-gray-500'}`}>
                    {key === '4x6' ? '🖼' : '📄'}
                  </div>
                  <p className="font-semibold text-sm">{val.label}</p>
                  <p className="text-xs text-gray-500">{val.sublabel}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Photo Quantity — pill buttons */}
          <div>
            <p className="text-sm text-gray-400 mb-3 uppercase tracking-wider font-medium">
              Number of Photos
            </p>
            <div className="flex gap-3">
              {qtyOptions.map(qty => (
                <button
                  key={qty}
                  onClick={() => setConfig({ ...config, photoCount: qty })}
                  className="flex-1 py-3 rounded-xl font-bold text-lg transition-all duration-200"
                  style={{
                    background: config.photoCount === qty
                      ? 'linear-gradient(135deg, #4f8aff, #a855f7)'
                      : 'var(--surface)',
                    color: config.photoCount === qty ? 'white' : 'var(--muted)',
                    border: config.photoCount === qty
                      ? '2px solid transparent'
                      : '2px solid var(--border)',
                    boxShadow: config.photoCount === qty ? '0 4px 16px rgba(79,138,255,0.35)' : 'none',
                    transform: config.photoCount === qty ? 'scale(1.05)' : 'scale(1)',
                  }}
                >
                  {qty}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-2">
              = {sheetsNeeded} sheet{sheetsNeeded > 1 ? 's' : ''} · {config.photoCount} passport photos
            </p>
          </div>

          {/* Background color */}
          <div>
            <p className="text-sm text-gray-400 mb-3 uppercase tracking-wider font-medium">Background Color</p>
            <div className="flex gap-2 flex-wrap">
              {['#ffffff', '#f0f0f0', '#e8f4f8', '#d4e8d4', '#fde8e8'].map(c => (
                <div
                  key={c}
                  className={`w-9 h-9 rounded-lg cursor-pointer border-2 transition-all ${config.bgColor === c ? 'border-blue-400 scale-110' : 'border-gray-600'}`}
                  style={{ background: c }}
                  onClick={() => setConfig({ ...config, bgColor: c })}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right: Live Sheet Preview */}
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-gray-400 uppercase tracking-wider font-medium">Sheet Preview</p>
          <div
            className="rounded-xl overflow-hidden shadow-lg border border-gray-700"
            style={{
              background: config.bgColor,
              display: 'grid',
              gridTemplateColumns: `repeat(${previewCols}, ${cellW}px)`,
              gap: '4px',
              padding: '8px',
            }}
          >
            {Array.from({ length: totalSlots }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: cellW,
                  height: cellH,
                  overflow: 'hidden',
                  borderRadius: '3px',
                  opacity: i < previewCount ? 1 : 0.15,
                  border: i < previewCount ? 'none' : '1px dashed #444',
                }}
              >
                {i < previewCount ? (
                  <img
                    src={photoUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#2a2a3a' }} />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">
              <span className="text-blue-400 font-semibold">{config.photoCount}</span> photos selected
              <span className="text-gray-600"> / {totalSlots} slots</span>
            </p>
            <p className="text-xs text-gray-600">
              {layout.cols}×{layout.rows} grid · {LAYOUTS[config.sheetSize].label}
            </p>
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
function Step4Download({
  photoUrl,
  config,
  onBack,
  onRestart,
}: {
  photoUrl: string;
  config: PhotoConfig;
  onBack: () => void;
  onRestart: () => void;
}) {
  const layout = LAYOUTS[config.sheetSize];
  const [downloading, setDownloading] = useState(false);

  const sheetsNeeded = Math.ceil(config.photoCount / layout.perSheet);

  // Preview cell sizes
  const isA4 = config.sheetSize === 'a4';
  const CELL_W = isA4 ? 42 : 48;
  const CELL_H = isA4 ? 54 : 58;
  const GAP = 4;
  const PAD = 8;

  const downloadPDF = async () => {
    setDownloading(true);
    try {
      const sheetW = config.sheetSize === '4x6' ? 101.6 : 210;
      const sheetH = config.sheetSize === '4x6' ? 152.4 : 297;
      const photoW = 35;
      const photoH = 45;
      const gapX = (sheetW - layout.cols * photoW) / (layout.cols + 1);
      const gapY = (sheetH - layout.rows * photoH) / (layout.rows + 1);

      // Load image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise(res => { img.onload = res; img.src = photoUrl; });

      let remaining = config.photoCount;

      for (let s = 0; s < sheetsNeeded; s++) {
        const photosThisSheet = Math.min(remaining, layout.perSheet);
        remaining -= photosThisSheet;

        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [sheetW, sheetH],
        });

        pdf.setFillColor(config.bgColor);
        pdf.rect(0, 0, sheetW, sheetH, 'F');

        let count = 0;
        outer: for (let row = 0; row < layout.rows; row++) {
          for (let col = 0; col < layout.cols; col++) {
            if (count >= photosThisSheet) break outer;
            const x = gapX + col * (photoW + gapX);
            const y = gapY + row * (photoH + gapY);
            pdf.addImage(img, 'PNG', x, y, photoW, photoH);
            count++;
          }
        }

        const delay = s * 350;
        setTimeout(() => pdf.save(`passport-photos-${config.sheetSize}-sheet${s + 1}.pdf`), delay);
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
    const photoW = '35mm';
    const photoH = '45mm';

    let remaining = config.photoCount;
    const sheets = Array.from({ length: sheetsNeeded }).map(() => {
      const photosThisSheet = Math.min(remaining, layout.perSheet);
      remaining -= photosThisSheet;
      const photos = Array.from({ length: photosThisSheet })
        .map(() => `<img src="${photoUrl}" style="width:${photoW};height:${photoH};object-fit:cover;object-position:top;display:block;" />`)
        .join('');
      return `
        <div class="sheet" style="
          width:${sheetW};height:${sheetH};background:${config.bgColor};
          display:grid;grid-template-columns:repeat(${layout.cols},${photoW});
          grid-template-rows:repeat(${layout.rows},${photoH});
          justify-content:center;align-content:center;
          gap:4mm;padding:6mm;page-break-after:always;box-sizing:border-box;">
          ${photos}
        </div>`;
    }).join('');

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Passport Photos</title>
      <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:white;}
      @page{size:${sheetW} ${sheetH};margin:0;}
      @media print{.sheet{page-break-after:always;}}</style>
      </head><body>${sheets}</body></html>`);
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
        <span className="text-white font-semibold">{sheetsNeeded}</span> sheet{sheetsNeeded > 1 ? 's' : ''} ·{' '}
        {layout.label}
      </p>

      {/* Sheet previews */}
      <div className="flex flex-wrap justify-center gap-6 mb-10">
        {(() => {
          let rem = config.photoCount;
          return Array.from({ length: Math.min(sheetsNeeded, 3) }).map((_, si) => {
            const photosThisSheet = Math.min(rem, layout.perSheet);
            rem -= photosThisSheet;
            return (
              <div key={si} className="flex flex-col items-center gap-2">
                <div
                  className="rounded-xl overflow-hidden shadow-xl border border-gray-600"
                  style={{
                    background: config.bgColor,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${layout.cols}, ${CELL_W}px)`,
                    gap: `${GAP}px`,
                    padding: `${PAD}px`,
                  }}
                >
                  {Array.from({ length: layout.perSheet }).map((_, i) => (
                    <div key={i} style={{
                      width: CELL_W, height: CELL_H,
                      overflow: 'hidden', borderRadius: '2px',
                      opacity: i < photosThisSheet ? 1 : 0.1,
                    }}>
                      {i < photosThisSheet ? (
                        <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: '#2a2a3a' }} />
                      )}
                    </div>
                  ))}
                </div>
                <span className="text-xs text-gray-500">Sheet {si + 1} · {photosThisSheet} photos</span>
              </div>
            );
          });
        })()}
        {sheetsNeeded > 3 && (
          <div className="flex items-center text-gray-500 text-sm">+{sheetsNeeded - 3} more sheet{sheetsNeeded - 3 > 1 ? 's' : ''}</div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-4 justify-center">
        <button className="btn-primary flex items-center gap-2 px-8 py-3" onClick={downloadPDF} disabled={downloading}>
          {downloading ? (
            <>
              <span style={{display:'inline-block',width:16,height:16,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',animation:'spin 0.8s linear infinite'}}/>
              Generating PDFs...
            </>
          ) : (
            <>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              Download PDF{sheetsNeeded > 1 ? `s (${sheetsNeeded})` : ''}
            </>
          )}
        </button>

        <button className="btn-secondary flex items-center gap-2 px-8 py-3" onClick={handlePrint}>
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/>
          </svg>
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

  const handleUpload = (_file: File, url: string) => {
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
        <h1
          className="text-5xl md:text-6xl font-black tracking-widest mb-2"
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            background: 'linear-gradient(135deg, #4f8aff, #a855f7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          PASSPORT PRO
        </h1>
        <p className="text-gray-500 text-sm tracking-wider uppercase">Instant Passport Photo Generator</p>
      </div>

      <StepBar current={step} />

      <div className="glass-card w-full max-w-3xl p-8 md:p-12">
        {step === 1 && <Step1Upload onUpload={handleUpload} />}
        {step === 2 && (
          <Step2RemoveBg
            originalUrl={originalUrl}
            onDone={handleBgDone}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Step3Layout
            photoUrl={processedUrl}
            config={config}
            setConfig={setConfig}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <Step4Download
            photoUrl={processedUrl}
            config={config}
            onBack={() => setStep(3)}
            onRestart={handleRestart}
          />
        )}
      </div>

      <p className="text-gray-700 text-xs mt-8 text-center">
        Passport photos 35×45mm · 4×6: 3×3 grid · A4: 4×5 grid · Powered by Remove.bg
      </p>
    </main>
  );
}
