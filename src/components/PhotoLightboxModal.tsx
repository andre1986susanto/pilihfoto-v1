import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Eraser,
  Hand,
  MapPin,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  DriveMediaItem,
  PhotoAnnotation,
  PhotoRevisionDetail,
  PhotoSelectionItem,
} from '../types/studio';

interface PhotoLightboxModalProps {
  mode: 'selection' | 'revision';
  mediaList: DriveMediaItem[];
  currentIndex: number;
  onChangeIndex: (nextIndex: number) => void;
  onClose: () => void;
  // Selection mode props
  selectionMap?: Record<string, PhotoSelectionItem>;
  onToggleSelection?: (
    file: DriveMediaItem,
    field: 'pilih_album' | 'pilih_kanvas' | 'pilih_tambahan'
  ) => void;
  onUpdateSelectionNote?: (file: DriveMediaItem, note: string) => void;
  // Revision annotation mode props
  revisionMap?: Record<string, PhotoRevisionDetail>;
  onSaveRevisionDetail?: (detail: PhotoRevisionDetail) => void;
}

type AnnotationTool = 'circle' | 'pin' | 'pan';

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  mode,
  mediaList,
  currentIndex,
  onChangeIndex,
  onClose,
  selectionMap = {},
  onToggleSelection,
  onUpdateSelectionNote,
  revisionMap = {},
  onSaveRevisionDetail,
}) => {
  const currentItem = mediaList[currentIndex];

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Annotation state for revision mode
  const [activeTool, setActiveTool] = useState<AnnotationTool>(
    mode === 'revision' ? 'circle' : 'pan'
  );
  const [localAnnotations, setLocalAnnotations] = useState<PhotoAnnotation[]>([]);
  const [localRevisionNote, setLocalRevisionNote] = useState('');
  const [drawingCircle, setDrawingCircle] = useState<{
    startX: number;
    startY: number;
    currX: number;
    currY: number;
  } | null>(null);
  const [savedBanner, setSavedBanner] = useState(false);
  const [isHighResLoading, setIsHighResLoading] = useState(true);

  const imageContainerRef = useRef<HTMLDivElement | null>(null);

  // Reset zoom/pan and load photo's annotations when photo changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSavedBanner(false);
    setIsHighResLoading(true);
    if (currentItem && mode === 'revision') {
      const existing = revisionMap[currentItem.id];
      setLocalAnnotations(existing?.annotations ? [...existing.annotations] : []);
      setLocalRevisionNote(existing?.catatan_revisi || '');
    }
  }, [currentItem?.id, mode]);

  // Keyboard shortcuts: Escape to close, ArrowLeft / ArrowRight to switch photos
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select';

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (!isTyping && e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault();
        onChangeIndex(currentIndex - 1);
      } else if (
        !isTyping &&
        e.key === 'ArrowRight' &&
        currentIndex < mediaList.length - 1
      ) {
        e.preventDefault();
        onChangeIndex(currentIndex + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, mediaList.length, onChangeIndex, onClose]);

  if (!currentItem) return null;

  const selection = selectionMap[currentItem.id];
  const isVideo = currentItem.mimeType?.startsWith('video/');

  const adjustZoom = (nextZoom: number) => {
    const clamped = Math.min(3, Math.max(1, Number(nextZoom.toFixed(2))));
    setZoom(clamped);
    if (clamped === 1) {
      setPan({ x: 0, y: 0 });
    }
  };

  const getRelativeCoords = (clientX: number, clientY: number) => {
    const rect = imageContainerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) {
      return { x: 50, y: 50 };
    }
    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isVideo) return;
    if (mode === 'revision' && activeTool === 'circle') {
      e.currentTarget.setPointerCapture(e.pointerId);
      const pt = getRelativeCoords(e.clientX, e.clientY);
      setDrawingCircle({
        startX: pt.x,
        startY: pt.y,
        currX: pt.x,
        currY: pt.y,
      });
      return;
    }

    if (mode === 'revision' && activeTool === 'pin') {
      const pt = getRelativeCoords(e.clientX, e.clientY);
      const pinCount = localAnnotations.filter((a) => a.type === 'pin').length;
      const newPin: PhotoAnnotation = {
        id: `ANN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'pin',
        x: pt.x,
        y: pt.y,
        pinNumber: pinCount + 1,
      };
      const updated = [...localAnnotations, newPin];
      setLocalAnnotations(updated);
      onSaveRevisionDetail?.({
        file_id: currentItem.id,
        file_name: currentItem.name,
        catatan_revisi: localRevisionNote,
        annotations: updated,
      });
      return;
    }

    if (zoom > 1 || activeTool === 'pan') {
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drawingCircle) {
      const pt = getRelativeCoords(e.clientX, e.clientY);
      setDrawingCircle((prev) =>
        prev ? { ...prev, currX: pt.x, currY: pt.y } : null
      );
      return;
    }
    if (isPanning && zoom > 1) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      });
    }
  };

  const handlePointerUp = () => {
    if (drawingCircle) {
      const cx = (drawingCircle.startX + drawingCircle.currX) / 2;
      const cy = (drawingCircle.startY + drawingCircle.currY) / 2;
      const rx = Math.max(3, Math.abs(drawingCircle.currX - drawingCircle.startX) / 2);
      const ry = Math.max(3, Math.abs(drawingCircle.currY - drawingCircle.startY) / 2);
      const newCircle: PhotoAnnotation = {
        id: `ANN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'circle',
        x: cx,
        y: cy,
        rx,
        ry,
      };
      const updated = [...localAnnotations, newCircle];
      setLocalAnnotations(updated);
      setDrawingCircle(null);
      onSaveRevisionDetail?.({
        file_id: currentItem.id,
        file_name: currentItem.name,
        catatan_revisi: localRevisionNote,
        annotations: updated,
      });
    }
    setIsPanning(false);
  };

  const handleUndoAnnotation = () => {
    const updated = localAnnotations.slice(0, -1);
    setLocalAnnotations(updated);
    onSaveRevisionDetail?.({
      file_id: currentItem.id,
      file_name: currentItem.name,
      catatan_revisi: localRevisionNote,
      annotations: updated,
    });
  };

  const handleClearAnnotations = () => {
    setLocalAnnotations([]);
    onSaveRevisionDetail?.({
      file_id: currentItem.id,
      file_name: currentItem.name,
      catatan_revisi: localRevisionNote,
      annotations: [],
    });
  };

  const handleSaveRevisionExplicit = () => {
    onSaveRevisionDetail?.({
      file_id: currentItem.id,
      file_name: currentItem.name,
      catatan_revisi: localRevisionNote,
      annotations: localAnnotations,
    });
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2000);
  };

  const statusTags: string[] = [];
  if (selection?.pilih_album) statusTags.push('Album');
  if (selection?.pilih_kanvas) statusTags.push('Kanvas');
  if (selection?.pilih_tambahan) statusTags.push('Foto Tambahan');

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1B1411]/95 text-[#FAF7F2] flex flex-col lg:flex-row overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={`Pratinjau ${currentItem.name}`}
    >
      {/* Left / Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
        {/* Top Control Bar */}
        <div className="px-4 sm:px-6 py-3 bg-[#241B17] border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs sm:text-sm font-medium text-[#FAF7F2] truncate">
              {currentItem.name}
            </p>
            <p className="text-xs text-[#C7B9AC] tabular-nums">
              Foto {currentIndex + 1} dari {mediaList.length}
              {statusTags.length > 0 ? ` · Terpilih: ${statusTags.join(' + ')}` : ''}
            </p>
          </div>

          {/* Zoom Controls */}
          {!isVideo && (
            <div className="flex items-center gap-2 bg-[#1B1411] px-3 py-1.5 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => adjustZoom(zoom - 0.25)}
                disabled={zoom <= 1}
                aria-label="Perkecil foto"
                className="w-8 h-8 rounded flex items-center justify-center text-[#FAF7F2] hover:bg-white/10 disabled:opacity-40 cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[11px] text-[#C7B9AC] uppercase tracking-wider hidden sm:inline">
                MIN
              </span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                aria-label="Penggeser tingkat zoom"
                onChange={(e) => adjustZoom(parseFloat(e.target.value))}
                className="w-20 sm:w-28 accent-[#C6A464] cursor-pointer"
              />
              <span className="text-[11px] text-[#C7B9AC] uppercase tracking-wider hidden sm:inline">
                MAX
              </span>
              <button
                type="button"
                onClick={() => adjustZoom(zoom + 0.25)}
                disabled={zoom >= 3}
                aria-label="Perbesar foto"
                className="w-8 h-8 rounded flex items-center justify-center text-[#FAF7F2] hover:bg-white/10 disabled:opacity-40 cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <span className="font-mono text-xs text-[#E3C78D] w-11 text-right tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup tampilan foto"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-[#FAF7F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Tutup</span>
          </button>
        </div>

        {/* Revision Annotation Toolbar (Only in Revision mode) */}
        {mode === 'revision' && !isVideo && (
          <div className="px-4 py-2.5 bg-[#2D221D] border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTool('circle')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTool === 'circle'
                    ? 'bg-[#C6A464] text-[#1B1411]'
                    : 'bg-white/10 text-[#FAF7F2] hover:bg-white/15'
                }`}
              >
                <Circle className="w-3.5 h-3.5" />
                <span>LINGKARI BAGIAN</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('pin')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTool === 'pin'
                    ? 'bg-[#C6A464] text-[#1B1411]'
                    : 'bg-white/10 text-[#FAF7F2] hover:bg-white/15'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>TITIK PIN</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('pan')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTool === 'pan'
                    ? 'bg-[#C6A464] text-[#1B1411]'
                    : 'bg-white/10 text-[#FAF7F2] hover:bg-white/15'
                }`}
              >
                <Hand className="w-3.5 h-3.5" />
                <span>GESER / PAN</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUndoAnnotation}
                disabled={localAnnotations.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 text-xs font-medium text-[#FAF7F2] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>UNDO</span>
              </button>
              <button
                type="button"
                onClick={handleClearAnnotations}
                disabled={localAnnotations.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#9E2A2B]/80 hover:bg-[#9E2A2B] disabled:opacity-40 text-xs font-medium text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Hapus Semua Tanda</span>
              </button>
            </div>
          </div>
        )}

        {/* Center Image / Video Canvas */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4 sm:p-8 select-none">
          {/* Prev Button */}
          <button
            type="button"
            onClick={() => onChangeIndex(currentIndex - 1)}
            disabled={currentIndex <= 0}
            aria-label="Foto sebelumnya"
            className="absolute left-3 sm:left-5 z-20 w-11 h-11 rounded-full bg-[#2A201B]/85 border border-white/15 flex items-center justify-center text-[#FAF7F2] hover:bg-[#C6A464] hover:text-[#1B1411] disabled:opacity-25 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Media Wrapper */}
          {isVideo ? (
            <video
              src={currentItem.previewUrl}
              controls
              className="max-w-full max-h-full rounded-lg shadow-2xl"
            />
          ) : (
            <div
              ref={imageContainerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                cursor:
                  mode === 'revision' && (activeTool === 'circle' || activeTool === 'pin')
                    ? 'crosshair'
                    : zoom > 1
                    ? 'grab'
                    : 'default',
              }}
              className="relative max-w-full max-h-full flex items-center justify-center transition-transform duration-75"
            >
              <img
                src={currentItem.previewUrl}
                alt={currentItem.name}
                referrerPolicy="no-referrer"
                draggable={false}
                onLoad={() => setIsHighResLoading(false)}
                className="max-w-full max-h-[70vh] lg:max-h-[82vh] w-auto h-auto object-contain rounded shadow-2xl"
              />

              {isHighResLoading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1B1411]/80 border border-white/10 text-xs text-[#FAF7F2] shadow-lg">
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-[#C6A464] border-t-transparent animate-spin" />
                    <span>Memuat Foto Kualitas Tinggi...</span>
                  </div>
                </div>
              )}

              {/* SVG Overlay for Circle & Pin Annotations */}
              {mode === 'revision' && (
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                >
                  {localAnnotations.map((ann) => {
                    if (ann.type === 'circle') {
                      return (
                        <ellipse
                          key={ann.id}
                          cx={ann.x}
                          cy={ann.y}
                          rx={ann.rx || 8}
                          ry={ann.ry || 8}
                          fill="rgba(225, 29, 72, 0.14)"
                          stroke="#F43F5E"
                          strokeWidth="0.7"
                          vectorEffect="non-scaling-stroke"
                        />
                      );
                    }
                    return null;
                  })}
                  {drawingCircle && (
                    <ellipse
                      cx={(drawingCircle.startX + drawingCircle.currX) / 2}
                      cy={(drawingCircle.startY + drawingCircle.currY) / 2}
                      rx={Math.max(
                        2,
                        Math.abs(drawingCircle.currX - drawingCircle.startX) / 2
                      )}
                      ry={Math.max(
                        2,
                        Math.abs(drawingCircle.currY - drawingCircle.startY) / 2
                      )}
                      fill="rgba(198, 164, 100, 0.2)"
                      stroke="#E3C78D"
                      strokeWidth="0.8"
                      strokeDasharray="2 1"
                    />
                  )}
                </svg>
              )}

              {/* Numbered Pin Overlays */}
              {mode === 'revision' &&
                localAnnotations
                  .filter((a) => a.type === 'pin')
                  .map((pin) => (
                    <div
                      key={pin.id}
                      style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#E11D48] text-white border-2 border-white text-xs font-bold flex items-center justify-center shadow-md pointer-events-none tabular-nums"
                    >
                      {pin.pinNumber || '•'}
                    </div>
                  ))}
            </div>
          )}

          {/* Next Button */}
          <button
            type="button"
            onClick={() => onChangeIndex(currentIndex + 1)}
            disabled={currentIndex >= mediaList.length - 1}
            aria-label="Foto berikutnya"
            className="absolute right-3 sm:right-5 z-20 w-11 h-11 rounded-full bg-[#2A201B]/85 border border-white/15 flex items-center justify-center text-[#FAF7F2] hover:bg-[#C6A464] hover:text-[#1B1411] disabled:opacity-25 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Right Control Sidebar (Selection Controls or Revision Note Controls) */}
      <aside className="w-full lg:w-96 bg-[#FAF7F2] text-[#2A201B] border-t lg:border-t-0 lg:border-l border-[#E6DDD0] p-5 sm:p-6 overflow-y-auto max-h-[42vh] lg:max-h-none shrink-0 space-y-5">
        {mode === 'selection' ? (
          <>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-[#8C6B30]">
                Pilihan &amp; Catatan Foto
              </p>
              <h3 className="font-serif text-xl font-semibold text-[#2A201B] mt-0.5 break-all">
                {currentItem.name}
              </h3>
              <p className="text-xs text-[#75655A] mt-0.5 tabular-nums">
                Tanggal: {currentItem.createdTime?.slice(0, 10) || '-'}
              </p>
            </div>

            {/* Action Buttons: ALBUM, KANVAS, FOTO TAMBAHAN */}
            <div className="space-y-2.5">
              <p className="text-xs font-medium uppercase tracking-wider text-[#5E534B]">
                Tentukan Kategori Pilihan
              </p>

              <button
                type="button"
                onClick={() => onToggleSelection?.(currentItem, 'pilih_album')}
                className={`w-full min-h-[44px] px-4 py-2.5 rounded-lg border text-sm font-medium flex items-center justify-between transition-colors cursor-pointer ${
                  selection?.pilih_album
                    ? 'bg-[#2A201B] text-[#FAF7F2] border-[#2A201B]'
                    : 'bg-white text-[#2A201B] border-[#E6DDD0] hover:border-[#8C6B30]'
                }`}
              >
                <span>PILIH ALBUM</span>
                {selection?.pilih_album && <Check className="w-4 h-4 text-[#E3C78D]" />}
              </button>

              <button
                type="button"
                onClick={() => onToggleSelection?.(currentItem, 'pilih_kanvas')}
                className={`w-full min-h-[44px] px-4 py-2.5 rounded-lg border text-sm font-medium flex items-center justify-between transition-colors cursor-pointer ${
                  selection?.pilih_kanvas
                    ? 'bg-[#8C6B30] text-white border-[#8C6B30]'
                    : 'bg-white text-[#2A201B] border-[#E6DDD0] hover:border-[#8C6B30]'
                }`}
              >
                <span>PILIH KANVAS</span>
                {selection?.pilih_kanvas && <Check className="w-4 h-4 text-white" />}
              </button>

              <button
                type="button"
                disabled={Boolean(selection?.pilih_album)}
                onClick={() => onToggleSelection?.(currentItem, 'pilih_tambahan')}
                className={`w-full min-h-[44px] px-4 py-2.5 rounded-lg border text-sm font-medium flex items-center justify-between transition-colors ${
                  selection?.pilih_album
                    ? 'bg-[#F3ECE1] text-[#75655A] border-[#E6DDD0] opacity-60 cursor-not-allowed'
                    : selection?.pilih_tambahan
                    ? 'bg-[#4A3B32] text-white border-[#4A3B32] cursor-pointer'
                    : 'bg-white text-[#2A201B] border-[#E6DDD0] hover:border-[#8C6B30] cursor-pointer'
                }`}
              >
                <span>FOTO TAMBAHAN</span>
                {selection?.pilih_tambahan && <Check className="w-4 h-4 text-white" />}
              </button>
              {selection?.pilih_album && (
                <p className="text-xs text-[#8C6B30]">
                  Foto yang sudah dipilih untuk Album tidak dapat dipilih sebagai Foto Tambahan.
                </p>
              )}
            </div>

            {/* Per-photo Edit Note */}
            <div>
              <label
                htmlFor="lightbox-edit-note"
                className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1.5"
              >
                Catatan Khusus Foto Ini
              </label>
              <textarea
                id="lightbox-edit-note"
                rows={3}
                placeholder="Contoh: Tolong cerahkan wajah sedikit, rapikan rambut..."
                value={selection?.catatan_edit || ''}
                onChange={(e) => onUpdateSelectionNote?.(currentItem, e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-white text-sm text-[#2A201B] focus:outline-none focus:border-[#8C6B30]"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-[#8C6B30]">
                Zoom &amp; Tandai Revisi
              </p>
              <h3 className="font-serif text-xl font-semibold text-[#2A201B] mt-0.5 break-all">
                {currentItem.name}
              </h3>
              <p className="text-xs text-[#5E534B] mt-1">
                Gunakan <strong>LINGKARI BAGIAN</strong> atau <strong>TITIK PIN</strong> langsung
                pada foto di sebelah kiri untuk menandai bagian yang ingin diperbaiki.
              </p>
            </div>

            <div className="bg-white border border-[#E6DDD0] rounded-lg p-3.5 flex items-center justify-between text-xs">
              <span className="text-[#5E534B]">Jumlah Tanda pada Foto Ini</span>
              <span className="font-mono font-semibold text-[#2A201B] tabular-nums">
                {localAnnotations.length} tanda
              </span>
            </div>

            <div>
              <label
                htmlFor="lightbox-revision-note"
                className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1.5"
              >
                Catatan Perbaikan / Revisi Foto
              </label>
              <textarea
                id="lightbox-revision-note"
                rows={4}
                placeholder="Contoh: Tolong hilangkan orang di belakang yang sudah dilingkari, dan cerahkan warna kulit..."
                value={localRevisionNote}
                onChange={(e) => setLocalRevisionNote(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-white text-sm text-[#2A201B] focus:outline-none focus:border-[#8C6B30]"
              />
            </div>

            <button
              type="button"
              onClick={handleSaveRevisionExplicit}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-[#2A201B] text-[#FAF7F2] text-sm font-medium hover:bg-[#3F312A] transition-colors cursor-pointer"
            >
              Simpan Tanda &amp; Catatan Revisi
            </button>

            {savedBanner && (
              <p className="text-xs font-medium text-[#1F6E43] text-center">
                Tanda &amp; catatan revisi untuk foto ini tersimpan.
              </p>
            )}
          </>
        )}
      </aside>
    </div>
  );
};
