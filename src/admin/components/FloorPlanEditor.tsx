import { api } from '../../lib/api';
import { notifyApiDataChanged } from '../../lib/apiData';
import { useState, useRef, useCallback, useEffect } from 'react';
import { X, MapPin, Check, Image as ImageIcon, Loader2, AlertCircle, Save } from 'lucide-react';
import { apiClient } from '../../lib/apiCompat';
import { Device, Floor } from '../../types';
import { statusColor } from '../../lib/colors';
import { useT, useLang } from '../../lib/i18n';
import { useFloorPlanUpload } from '../hooks/useFloorPlanUpload';
import { useFloorPlanFit } from '../../hooks/useFloorPlanFit';
import { hasFloorPlanCoordinates } from '../../lib/mapCoordinates';
import { FloorPlanCoordinateNotice } from '../../components/MapStatus';

interface Props {
  floor: Floor & { buildings?: { id: string; name: string; sites?: { id: string; name: string } } };
  devices: Device[];
  highlightDeviceId?: string;
  onClose: () => void;
}

const FLOOR_PLAN_MUTATIONS_SUPPORTED = true;

function hasCoordinates(device: Device): device is Device & { position_x: number; position_y: number } {
  return hasFloorPlanCoordinates(device);
}

function freshImageUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const freshUrl = new URL(url, window.location.origin);
    freshUrl.searchParams.set('_v', String(Date.now()));
    return freshUrl.toString();
  } catch {
    return url;
  }
}

export function FloorPlanEditor({ floor, devices, highlightDeviceId, onClose }: Props) {
  const t = useT();
  const { lang } = useLang();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [floorDevices, setFloorDevices] = useState<Device[]>(devices);
  const savedPositionsRef = useRef(new Map(devices.map(device => [device.id, {
    x: device.position_x,
    y: device.position_y,
  }])));
  const dragRef = useRef<{ id: string; code: string; originalX: number | null; originalY: number | null; x: number; y: number } | null>(null);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [savingPosition, setSavingPosition] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(highlightDeviceId ?? null);
  const [liveCoords, setLiveCoords] = useState<{ x: number; y: number } | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(() => freshImageUrl(floor.image_url ?? null));
  const [persistedImageUrl, setPersistedImageUrl] = useState<string | null>(floor.image_url ?? null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [removeImagePending, setRemoveImagePending] = useState(false);
  const previewUrlRef = useRef<string | null>(null);
  const imageEditedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, removeImage, uploading } = useFloorPlanUpload();
  const { fitRect, imageError } = useFloorPlanFit(imageUrl, viewportRef);

  const refreshFloorImage = useCallback(async () => {
    const { data } = await apiClient
      .from('admin_floors')
      .select('image_url')
      .eq('id', floor.id)
      .maybeSingle();
    if (!imageEditedRef.current && data) {
      const url = data.image_url ?? null;
      setImageUrl(freshImageUrl(url));
      setPersistedImageUrl(url);
    }
  }, [floor.id]);

  useEffect(() => {
    refreshFloorImage();
  }, [refreshFloorImage]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      setPositionError(lang === 'en' ? 'Only PNG, JPG, and WebP images are supported.' : lang === 'zh-CN' ? '仅支持 PNG、JPG 和 WebP 图片。' : '僅支援 PNG、JPG 和 WebP 圖片。');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const previewUrl = URL.createObjectURL(file);
    previewUrlRef.current = previewUrl;
    imageEditedRef.current = true;
    setPendingImageFile(file);
    setRemoveImagePending(false);
    setImageUrl(previewUrl);
    setPositionError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImage = () => {
    if (!imageUrl) return;
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    imageEditedRef.current = true;
    setPendingImageFile(null);
    setRemoveImagePending(Boolean(persistedImageUrl));
    setImageUrl(null);
    setPositionError(null);
  };

  const coordinates = (e: React.PointerEvent) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect || !fitRect || fitRect.width <= 0 || fitRect.height <= 0) return null;
    return {
      x: Math.round(Math.max(0, Math.min(100, (e.clientX - rect.left - fitRect.left) / fitRect.width * 100)) * 10) / 10,
      y: Math.round(Math.max(0, Math.min(100, (e.clientY - rect.top - fitRect.top) / fitRect.height * 100)) * 10) / 10,
    };
  };
  const onPointerDown = (e: React.PointerEvent, device: Device) => {
    if (savingPosition) return;
    const point = coordinates(e);
    if (!point) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: device.id, code: device.code, originalX: device.position_x, originalY: device.position_y, ...point };
    setPositionError(null); setDraggingId(device.id); setHighlightedId(device.id); setLiveCoords(point);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const point = coordinates(e);
    if (!drag || !point) return;
    Object.assign(drag, point);
    setLiveCoords(point);
    setFloorDevices(rows => rows.map(device => device.id === drag.id ? { ...device, position_x: point.x, position_y: point.y } : device));
  };
  const cancelDrag = () => {
    const drag = dragRef.current;
    if (drag) setFloorDevices(rows => rows.map(device => device.id === drag.id ? { ...device, position_x: drag.originalX, position_y: drag.originalY } : device));
    dragRef.current = null; setDraggingId(null); setLiveCoords(null);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = coordinates(e) ?? { x: drag.x, y: drag.y };
    dragRef.current = null;
    setDraggingId(null);
    setLiveCoords(null);
    setFloorDevices(rows => rows.map(device => device.id === drag.id ? { ...device, position_x: point.x, position_y: point.y } : device));
  };

  const changedDevices = floorDevices.filter(device => {
    if (!hasCoordinates(device)) return false;
    const saved = savedPositionsRef.current.get(device.id);
    return !saved || saved.x !== device.position_x || saved.y !== device.position_y;
  });
  const hasUnsavedChanges = changedDevices.length > 0 || pendingImageFile !== null || removeImagePending;
  const isBusy = savingPosition || uploading;

  const saveChanges = async () => {
    if (!hasUnsavedChanges || isBusy) return;
    setSavingPosition(true);
    setPositionError(null);
    let savedPositionCount = 0;
    try {
      for (const device of changedDevices) {
        if (!hasCoordinates(device)) continue;
        await api.admin.updatePosition(device.code, {
          position_x: device.position_x,
          position_y: device.position_y,
        });
        savedPositionsRef.current.set(device.id, { x: device.position_x, y: device.position_y });
        savedPositionCount += 1;
        setSavedFlash(device.id);
        window.setTimeout(() => setSavedFlash(current => current === device.id ? null : current), 1500);
      }
      if (savedPositionCount > 0) notifyApiDataChanged();

      if (pendingImageFile) {
        const uploadedUrl = await upload(floor.api_id ?? floor.id, pendingImageFile);
        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current);
          previewUrlRef.current = null;
        }
        setImageUrl(freshImageUrl(uploadedUrl));
        setPersistedImageUrl(uploadedUrl);
        setPendingImageFile(null);
        setRemoveImagePending(false);
      } else if (removeImagePending) {
        await removeImage(floor.api_id ?? floor.id, persistedImageUrl ?? '');
        setImageUrl(null);
        setPersistedImageUrl(null);
        setRemoveImagePending(false);
      }
    } catch (failure) {
      if (savedPositionCount > 0) notifyApiDataChanged();
      const detail = failure instanceof Error ? failure.message : 'Save failed';
      setPositionError(savedPositionCount > 0
        ? `${lang === 'en' ? 'Some changes were saved; the remaining changes are still pending. ' : lang === 'zh-CN' ? '部分更改已保存，其余更改仍待保存。' : '部分更改已儲存，其餘更改仍待儲存。'}${detail}`
        : detail);
    } finally {
      setSavingPosition(false);
    }
  };

  const requestClose = () => {
    if (isBusy) return;
    if (hasUnsavedChanges && !window.confirm(lang === 'en'
      ? 'Discard unsaved floor-plan changes?'
      : lang === 'zh-CN' ? '放弃尚未保存的楼层图更改吗？' : '放棄尚未儲存的樓層圖更改嗎？')) return;
    onClose();
  };

  const sortedDevices = [...floorDevices].sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={requestClose} />
      <div className="relative w-full max-w-6xl h-[85vh] bg-gray-900 border border-gray-700/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/15 border border-blue-500/20">
              <MapPin size={16} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">{t('fpe_title') + ' — '}{floor.floor_label}</h2>
              <p className="text-gray-500 text-xs">
                {floor.buildings?.name ?? '—'}
                {floor.buildings?.sites?.name ? ` · ${floor.buildings.sites.name}` : ''}
                {' · '}{floorDevices.length} {lang === 'en' ? 'devices' : lang === 'zh-CN' ? '个设备' : '個設備'}
              </p>
            </div>
          </div>
          <button onClick={requestClose} className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-800">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Sidebar — device list */}
          <div className="w-64 flex-shrink-0 border-r border-gray-800/50 overflow-y-auto p-3 space-y-1">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-2">{t('fpe_devices')}</div>
            {sortedDevices.map(d => {
              const color = statusColor(d.status);
              const isHighlighted = highlightedId === d.id;
              const isSaved = savedFlash === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => setHighlightedId(d.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-all ${
                    isHighlighted ? 'bg-blue-500/15 border border-blue-500/30' : 'hover:bg-gray-800/50 border border-transparent'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-gray-300 font-medium truncate">{d.code}</span>
                  {isSaved ? (
                    <Check size={12} className="text-green-400 ml-auto flex-shrink-0" />
                  ) : (
                    <span className="text-gray-600 text-xs ml-auto flex-shrink-0">
                      {typeof d.position_x === 'number' && Number.isFinite(d.position_x) && typeof d.position_y === 'number' && Number.isFinite(d.position_y) ? `${Math.round(d.position_x)},${Math.round(d.position_y)}` : '—'}
                    </span>
                  )}
                </button>
              );
            })}
            {floorDevices.length === 0 && (
              <p className="text-gray-600 text-xs px-2 py-4">{t('fpe_no_devices')}</p>
            )}
          </div>

          {/* Main — floor plan canvas */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800/50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isBusy || !FLOOR_PLAN_MUTATIONS_SUPPORTED}
                  title="PNG / JPG / WebP"
                  className="flex items-center gap-2 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-3 py-2 rounded-xl font-medium transition-all"
                >
                  {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />}
                  {imageUrl ? (lang === 'en' ? 'Replace Image' : lang === 'zh-CN' ? '替换图片' : '替換圖片') : (lang === 'en' ? 'Upload Layout' : lang === 'zh-CN' ? '上传平面图' : '上傳平面圖')}
                </button>
                {imageUrl && (
                  <button
                    onClick={handleRemoveImage}
                    disabled={isBusy || !FLOOR_PLAN_MUTATIONS_SUPPORTED}
                    title="Remove the current floor-plan image"
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 px-3 py-2 rounded-xl border border-gray-700/50 hover:border-red-500/30 transition-all"
                  >
                    <X size={12} /> {lang === 'en' ? 'Remove' : lang === 'zh-CN' ? '移除' : '移除'}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {liveCoords && (
                  <span className="text-xs text-gray-400 font-mono bg-gray-800/60 px-2.5 py-1 rounded-lg border border-gray-700/50">
                    X: {liveCoords.x}% · Y: {liveCoords.y}%
                  </span>
                )}
                {savedFlash && (
                  <span className="text-xs text-green-400 flex items-center gap-1">
                    <Check size={12} /> {lang === 'en' ? 'Position saved' : lang === 'zh-CN' ? '位置已保存' : '位置已儲存'}
                  </span>
                )}
                {hasUnsavedChanges && <span className="text-xs text-amber-300">{t('fpe_unsaved')}</span>}
                <button
                  onClick={saveChanges}
                  disabled={!hasUnsavedChanges || isBusy || !FLOOR_PLAN_MUTATIONS_SUPPORTED}
                  className="flex items-center gap-2 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-3 py-2 rounded-xl font-medium transition-all"
                >
                  {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {isBusy ? t('fpe_saving') : t('fpe_save')}
                </button>
              </div>
            </div>

            {positionError && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">
                <AlertCircle size={13} />
                {positionError}
              </div>
            )}

            {/* Canvas */}
            <div
              ref={viewportRef}
              className="relative flex-1 bg-gray-950/80 overflow-hidden min-h-0"
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={cancelDrag}
              onLostPointerCapture={() => { if (dragRef.current) cancelDrag(); }}
            >
              {/* Background grid */}
              <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="editorGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#64748b" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#editorGrid)" />
              </svg>

              {/* Floor plan image — fitted wrapper shows full image without cropping */}
              {imageUrl && !imageError && fitRect ? (
                <div
                  className="absolute overflow-hidden"
                  style={{ left: fitRect.left, top: fitRect.top, width: fitRect.width, height: fitRect.height }}
                >
                  <img
                    src={imageUrl}
                    alt={floor.floor_label}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                    draggable={false}
                  />
                  {/* Device markers — positioned relative to the image area */}
                  {floorDevices.filter(hasCoordinates).map(d => {
                    const color = statusColor(d.status);
                    const isDragging = draggingId === d.id;
                    const isHighlighted = highlightedId === d.id;
                    const isSaved = savedFlash === d.id;
                    const deviceName = d.label || d.code;
                    return (
                      <div
                        key={d.id}
                        onPointerDown={FLOOR_PLAN_MUTATIONS_SUPPORTED ? (e) => onPointerDown(e, d) : undefined}
                        className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${FLOOR_PLAN_MUTATIONS_SUPPORTED ? 'cursor-grab touch-none' : 'cursor-default'} ${
                          isDragging ? 'cursor-grabbing z-30' : 'z-10'
                        } transition-transform ${isDragging ? 'scale-125' : isHighlighted ? 'scale-110' : 'hover:scale-110'}`}
                        style={{ left: `${d.position_x}%`, top: `${d.position_y}%` }}
                      >
                        {isHighlighted && (
                          <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ backgroundColor: color }} />
                        )}
                        <span
                          className={`relative flex items-center justify-center w-6 h-6 rounded-full border-2 shadow-lg ${isDragging ? 'ring-2 ring-blue-400' : ''}`}
                          style={{ backgroundColor: `${color}30`, borderColor: color }}
                        >
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                          {isSaved && <Check size={10} className="absolute -top-1 -right-1 text-green-400 bg-gray-900 rounded-full p-0.5" />}
                        </span>
                        <span
                          className="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 whitespace-nowrap rounded px-1.5 text-[10px] font-medium leading-tight"
                          style={{ color: '#e2e8f0', backgroundColor: 'rgba(2,13,37,0.85)' }}
                        >
                          {deviceName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : imageUrl && !imageError ? (
                <img
                  src={imageUrl}
                  alt={floor.floor_label}
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                  draggable={false}
                />
              ) : (
                <>
                  <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <rect x="5" y="5" width="90" height="90" fill="none" stroke="#60a5fa" strokeWidth="0.5" rx="1" />
                    <rect x="5" y="5" width="40" height="40" fill="none" stroke="#60a5fa" strokeWidth="0.3" />
                    <rect x="45" y="5" width="50" height="40" fill="none" stroke="#60a5fa" strokeWidth="0.3" />
                    <rect x="5" y="45" width="40" height="50" fill="none" stroke="#60a5fa" strokeWidth="0.3" />
                    <rect x="45" y="45" width="50" height="50" fill="none" stroke="#60a5fa" strokeWidth="0.3" />
                    <line x1="5" y1="45" x2="95" y2="45" stroke="#60a5fa" strokeWidth="0.5" strokeDasharray="2,2" />
                    <line x1="45" y1="5" x2="45" y2="95" stroke="#60a5fa" strokeWidth="0.5" strokeDasharray="2,2" />
                  </svg>
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 text-gray-600 text-xs">
                    <ImageIcon size={12} />
                    <span>{imageError ? (lang === 'en' ? 'Floor-plan image failed to load' : lang === 'zh-CN' ? '平面图图片加载失败，请检查图片地址或网络' : '平面圖圖片載入失敗，請檢查圖片地址或網絡') : (lang === 'en' ? 'Data not connected' : lang === 'zh-CN' ? '未接入数据' : '未接入資料')}</span>
                  </div>
                </>
              )}

              {/* Device markers — only rendered here when there's no fitted image wrapper.
                  When an image is fitted, markers are rendered inside the fitted rect above. */}
              <FloorPlanCoordinateNotice devices={floorDevices} />
              {!imageUrl && floorDevices.filter(hasCoordinates).map(d => {
                const color = statusColor(d.status);
                const isDragging = draggingId === d.id;
                const isHighlighted = highlightedId === d.id;
                const isSaved = savedFlash === d.id;
                const deviceName = d.label || d.code;
                return (
                  <div
                    key={d.id}
                    onPointerDown={FLOOR_PLAN_MUTATIONS_SUPPORTED ? (e) => onPointerDown(e, d) : undefined}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${FLOOR_PLAN_MUTATIONS_SUPPORTED ? 'cursor-grab touch-none' : 'cursor-default'} ${
                      isDragging ? 'cursor-grabbing z-30' : 'z-10'
                    } transition-transform ${isDragging ? 'scale-125' : isHighlighted ? 'scale-110' : 'hover:scale-110'}`}
                    style={{ left: `${d.position_x}%`, top: `${d.position_y}%` }}
                  >
                    {isHighlighted && (
                      <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ backgroundColor: color }} />
                    )}
                    <span
                      className={`relative flex items-center justify-center w-6 h-6 rounded-full border-2 shadow-lg ${isDragging ? 'ring-2 ring-blue-400' : ''}`}
                      style={{ backgroundColor: `${color}30`, borderColor: color }}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      {isSaved && <Check size={10} className="absolute -top-1 -right-1 text-green-400 bg-gray-900 rounded-full p-0.5" />}
                    </span>
                    <span
                      className="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 whitespace-nowrap rounded px-1.5 text-[10px] font-medium leading-tight"
                      style={{ color: '#e2e8f0', backgroundColor: 'rgba(2,13,37,0.85)' }}
                    >
                      {deviceName}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Hint bar */}
            <div className="px-4 py-2 border-t border-gray-800/50 flex-shrink-0 text-xs text-gray-500 flex items-center gap-2">
              <MapPin size={12} />
              {lang === 'en' ? 'Drag markers or change the image, then save your changes (0–100%).' : lang === 'zh-CN' ? '拖动设备图标或更换平面图后，点击保存提交（坐标范围 0–100%）。' : '拖動設備圖標或更換平面圖後，點擊儲存提交（座標範圍 0–100%）。'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
