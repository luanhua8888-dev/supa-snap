import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, RefreshCw, Sparkles, Image as ImageIcon, Check, RotateCcw, LayoutGrid, Music, Video } from 'lucide-react';
import { type CaptionBgStyle, type CaptionTextEffect } from '../lib/captionStyles';
import { CaptionStylePicker } from './CaptionStylePicker';
import {
  detectMediaTypeFromFile,
  normalizeMimeType,
  pickVideoRecorderMimeType,
} from '../lib/media';
import type { MediaType } from '../lib/media';
import { SnapVideo } from './SnapVideo';

const MAX_VIDEO_SECONDS = 60;
const JPEG_QUALITY = 1;

/**
 * deezerJsonp — queries Deezer Search API via JSONP (no CORS, no proxy, no API key).
 * Deezer supports ?output=jsonp&callback=name natively.
 * Audio preview CDN URLs (cdns-preview-*.dzcdn.net) also allow CORS natively.
 */
function deezerJsonp(query: string, limit = 20): Promise<any[]> {
  return new Promise((resolve) => {
    const cbName = `_dz_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}&output=jsonp&callback=${cbName}`;

    const cleanup = () => {
      delete (window as any)[cbName];
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    (window as any)[cbName] = (data: any) => {
      cleanup();
      resolve(Array.isArray(data?.data) ? data.data : []);
    };

    script.onerror = () => { cleanup(); resolve([]); };
    script.src = url;
    document.head.appendChild(script);

    // Safety timeout — resolve empty if no response in 8s
    setTimeout(() => { cleanup(); resolve([]); }, 8000);
  });
}

// Featured queries shown by default — covers popular + Vietnamese artists
const FEATURED_QUERIES = [
  'espresso sabrina carpenter',
  'as it was harry styles',
  'die with a smile lady gaga',
  'lover taylor swift',
  'perfect ed sheeran',
  'son tung mtp',
  'jack vietnam artist',
];

export interface Song {
  title: string;
  artist: string;
  albumArt: string;
  previewUrl: string;
}

function parseDeezerTrack(item: any): Song | null {
  if (!item?.preview || !item?.title) return null;
  return {
    title: item.title,
    artist: item.artist?.name ?? '',
    albumArt: item.album?.cover_medium ?? item.album?.cover ?? '',
    previewUrl: item.preview,
  };
}

interface CameraOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (
    blob: Blob,
    caption: string,
    mediaType: MediaType,
    songTitle?: string | null,
    songArtist?: string | null,
    songAlbumArt?: string | null,
    songPreviewUrl?: string | null,
    captionTextColor?: string | null,
    captionBgStyle?: string | null,
    captionTextEffect?: string | null,
    captionBgColor?: string | null
  ) => Promise<void>;
  isUploading: boolean;
}

export const CameraOverlay: React.FC<CameraOverlayProps> = ({
  isOpen,
  onClose,
  onUpload,
  isUploading,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Snap workflow states
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [showFlash, setShowFlash] = useState(false);
  const [showGrid, setShowGrid] = useState(true);

  // Music selector states
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isMusicDrawerOpen, setIsMusicDrawerOpen] = useState(false);
  const [playingPreview, setPlayingPreview] = useState<Song | null>(null);

  // Music Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Caption styling states
  const [captionTextColor, setCaptionTextColor] = useState('#ffffff');
  const [captionBgStyle, setCaptionBgStyle] = useState<CaptionBgStyle>('dark');
  const [captionBgColor, setCaptionBgColor] = useState('#ec4899');
  const [captionTextEffect, setCaptionTextEffect] = useState<CaptionTextEffect>('none');
  const [captureMode, setCaptureMode] = useState<'photo' | 'video'>('photo');
  const [previewMediaType, setPreviewMediaType] = useState<MediaType>('image');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  // Reset snap state when overlay closes; start camera when it opens
  useEffect(() => {
    if (!isOpen) {
      clearSnapState();
      stopCamera();
      cleanupAudioPreview();
      return;
    }

    navigator.mediaDevices.enumerateDevices()
      .then((devices) => {
        const videoDevices = devices.filter((device) => device.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      })
      .catch((err) => console.error('Error listing cameras:', err));

    setCameraError(null);
    startCamera();

    return () => {
      stopCamera();
      cleanupAudioPreview();
    };
  }, [isOpen, facingMode, captureMode]);

  // Load featured songs via JSONP when drawer opens (no CORS, no proxy)
  useEffect(() => {
    if (!isMusicDrawerOpen || searchResults.length > 0) return;
    loadFeaturedSongs();
  }, [isMusicDrawerOpen]);

  const loadFeaturedSongs = useCallback(async () => {
    setIsSearching(true);
    try {
      const results = await Promise.allSettled(
        FEATURED_QUERIES.map(q =>
          deezerJsonp(q, 1).then(data => parseDeezerTrack(data[0]))
        )
      );
      const songs = results
        .filter((r): r is PromiseFulfilledResult<Song> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);
      if (songs.length > 0) setSearchResults(songs);
    } catch (e) {
      console.error('Featured songs error:', e);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced Deezer search via JSONP (no fetch, no CORS, no proxy needed)
  useEffect(() => {
    if (!searchQuery.trim()) {
      if (searchResults.length === 0) loadFeaturedSongs();
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await deezerJsonp(searchQuery, 20);
        const songs = data.map(parseDeezerTrack).filter(Boolean) as Song[];
        setSearchResults(songs);
      } catch (err) {
        console.error('Deezer JSONP search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, loadFeaturedSongs]);

  const cleanupAudioPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.onended = null;
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setPlayingPreview(null);
  };

  const closeMusicDrawer = () => {
    cleanupAudioPreview();
    setIsMusicDrawerOpen(false);
    setSearchQuery('');
  };

  const handlePlayPreview = (song: Song) => {
    // Toggle off if same song
    if (playingPreview?.previewUrl === song.previewUrl) {
      cleanupAudioPreview();
      return;
    }
    cleanupAudioPreview();

    // Deezer preview URLs support CORS natively — play directly
    const audio = new Audio(song.previewUrl);
    audio.volume = 0.5;
    previewAudioRef.current = audio;
    setPlayingPreview(song);

    audio.play().catch(err => {
      console.error('Audio play error:', err);
      setPlayingPreview(null);
    });
    audio.onended = () => setPlayingPreview(null);
  };

  const startCamera = async () => {
    stopCamera();
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 4096 },
          height: { ideal: 4096 },
        },
        audio: captureMode === 'video',
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setCameraError(null);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Re-enumerate after permission — browsers often report only 1 camera before getUserMedia
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      } catch {
        setHasMultipleCameras(true);
      }
    } catch (err: any) {
      console.error('Camera access failed:', err);
      setCameraError(
        'Could not access camera. Make sure you grant permission, or choose a file from your gallery! 🌸'
      );
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const stopVideoRecording = useCallback(() => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const startVideoRecording = () => {
    if (!stream || isRecording) return;

    const mimeType = pickVideoRecorderMimeType();
    const blobMime = normalizeMimeType(mimeType);

    recordChunksRef.current = [];
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 12_000_000,
      audioBitsPerSecond: 192_000,
    });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordChunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(recordChunksRef.current, { type: blobMime });
      setCapturedBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewMediaType('video');
      stopCamera();
      setRecordSeconds(0);
    };

    recorder.start(200);
    setIsRecording(true);
    setRecordSeconds(0);

    recordTimerRef.current = setInterval(() => {
      setRecordSeconds((s) => {
        if (s + 1 >= MAX_VIDEO_SECONDS) {
          stopVideoRecording();
          return 0;
        }
        return s + 1;
      });
    }, 1000);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 150);

    const video = videoRef.current;
    const cropSize = Math.min(video.videoWidth, video.videoHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const outputSize = cropSize * dpr;

    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sx = (video.videoWidth - cropSize) / 2;
    const sy = (video.videoHeight - cropSize) / 2;

    ctx.scale(dpr, dpr);

    if (facingMode === 'user') {
      ctx.translate(cropSize, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, cropSize, cropSize);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlob(blob);
          setPreviewUrl(URL.createObjectURL(blob));
          setPreviewMediaType('image');
          stopCamera();
        }
      },
      'image/jpeg',
      JPEG_QUALITY
    );
  };

  const handleShutter = () => {
    if (captureMode === 'video') {
      if (isRecording) stopVideoRecording();
      else startVideoRecording();
    } else {
      capturePhoto();
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const mediaType = detectMediaTypeFromFile(file);
      setCapturedBlob(file);
      setPreviewUrl(URL.createObjectURL(file));
      setPreviewMediaType(mediaType);
      setCaptureMode(mediaType === 'video' ? 'video' : 'photo');
      stopCamera();
    }
  };

  const clearSnapState = useCallback(() => {
    stopVideoRecording();
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setCapturedBlob(null);
    setPreviewMediaType('image');
    setCaption('');
    setCaptionTextColor('#ffffff');
    setCaptionBgStyle('dark');
    setCaptionBgColor('#ec4899');
    setCaptionTextEffect('none');
    setCaptureMode('photo');
    setSelectedSong(null);
    closeMusicDrawer();
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [stopVideoRecording]);

  const resetCameraState = () => {
    clearSnapState();
    startCamera();
  };

  const handleUploadSubmit = async () => {
    if (!capturedBlob) return;
    await onUpload(
      capturedBlob,
      caption.trim(),
      previewMediaType,
      selectedSong?.title || null,
      selectedSong?.artist || null,
      selectedSong?.albumArt || null,
      selectedSong?.previewUrl || null,
      captionTextColor,
      captionBgStyle,
      captionTextEffect,
      captionBgStyle === 'custom' ? captionBgColor : null
    );
    clearSnapState();
  };

  const handleClose = () => {
    stopCamera();
    cleanupAudioPreview();
    clearSnapState();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="absolute inset-0 z-50 bg-[#090708] flex flex-col overflow-hidden"
        >
          {/* Top Bar Header */}
          <div className="flex items-center justify-between p-4 z-10 text-white flex-shrink-0">
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleClose}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/5 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4.5 h-4.5" />
            </motion.button>
            
            <span className="font-rounded font-extrabold text-[15px] text-pink-300 flex items-center space-x-1.5 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>{previewUrl ? 'Review Snap' : 'Take a Snap'}</span>
            </span>

            <div className="w-10" />
          </div>

          {/* Main Visual Viewfinder Area */}
          <div className="relative flex-1 flex flex-col items-center justify-center bg-[#090708] px-4 pb-2">
            {/* Flash Effect */}
            <AnimatePresence>
              {showFlash && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-white z-30"
                />
              )}
            </AnimatePresence>

            {/* Viewfinder Aspect Wrapper */}
            <div className="relative w-full aspect-square rounded-[2.5rem] overflow-hidden border-2 border-white/10 shadow-2xl bg-black max-w-[370px]">
              
              {previewUrl ? (
                previewMediaType === 'video' ? (
                  <SnapVideo
                    src={previewUrl}
                    autoPlay
                    className="bg-black"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Captured Snap"
                    className="w-full h-full object-cover"
                  />
                )
              ) : cameraError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 space-y-4">
                  <Camera className="w-12 h-12 text-pink-400 animate-pulse" />
                  <p className="text-xs text-zinc-400 max-w-[200px] leading-relaxed font-rounded">
                    {cameraError}
                  </p>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${
                    facingMode === 'user' ? 'scale-x-[-1]' : ''
                  }`}
                />
              )}

              {/* Grid Lines Overlay */}
              {showGrid && !previewUrl && (
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none z-10 opacity-70">
                  <div className="border-r border-b border-white/10"></div>
                  <div className="border-r border-b border-white/10"></div>
                  <div className="border-b border-white/10"></div>
                  <div className="border-r border-b border-white/10"></div>
                  <div className="border-r border-b border-white/10"></div>
                  <div className="border-b border-white/10"></div>
                  <div className="border-r border-white/10"></div>
                  <div className="border-r border-white/10"></div>
                  <div></div>
                </div>
              )}

              {/* Music HUD Indicator */}
              {selectedSong && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-4 left-4 z-20 flex items-center space-x-2 bg-black/60 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-full text-white text-[10px] font-bold font-rounded"
                >
                  <Music className="w-3.5 h-3.5 text-pink-400 animate-bounce" />
                  <span className="truncate max-w-[120px]">{selectedSong.title} - {selectedSong.artist}</span>
                </motion.div>
              )}

              {isRecording && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-red-500/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-red-300/40">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-[10px] font-extrabold text-white font-rounded">
                    REC {recordSeconds}s / {MAX_VIDEO_SECONDS}s
                  </span>
                </div>
              )}

              {/* Camera Toolbar HUD */}
              {!previewUrl && !cameraError && (
                <div className="absolute right-4 top-4 z-20 flex flex-col space-y-3">
                  <button
                    onClick={() => setShowGrid(!showGrid)}
                    className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md border transition-all cursor-pointer ${
                      showGrid
                        ? 'bg-pink-500 text-white border-pink-400 shadow-lg shadow-pink-500/20'
                        : 'bg-black/45 text-white/80 border-white/10 hover:bg-black/60'
                    }`}
                    title="Toggle Grid"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setIsMusicDrawerOpen(true)}
                    className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md border transition-all cursor-pointer ${
                      selectedSong
                        ? 'bg-pink-500 text-white border-pink-400 shadow-lg shadow-pink-500/20 animate-pulse'
                        : 'bg-black/45 text-white/80 border-white/10 hover:bg-black/60'
                    }`}
                    title="Attach Music"
                  >
                    <Music className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Caption + Styling — shown after capture */}
            {previewUrl && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <CaptionStylePicker
                  caption={caption}
                  onCaptionChange={setCaption}
                  captionTextColor={captionTextColor}
                  onTextColorChange={setCaptionTextColor}
                  captionBgStyle={captionBgStyle}
                  onBgStyleChange={setCaptionBgStyle}
                  captionBgColor={captionBgColor}
                  onBgColorChange={setCaptionBgColor}
                  captionTextEffect={captionTextEffect}
                  onTextEffectChange={setCaptionTextEffect}
                />
                <button
                  type="button"
                  onClick={() => setIsMusicDrawerOpen(true)}
                  className={`w-full max-w-[370px] mx-auto mt-2 flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-extrabold font-rounded border cursor-pointer ${
                    selectedSong
                      ? 'bg-pink-500/20 text-pink-200 border-pink-400/40'
                      : 'bg-white/5 text-zinc-400 border-white/10'
                  }`}
                >
                  <Music className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[220px]">
                    {selectedSong ? `${selectedSong.title} · ${selectedSong.artist}` : 'Thêm nhạc nền'}
                  </span>
                </button>
              </motion.div>
            )}
          </div>

          {/* Hidden Gallery Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,video/*"
            className="hidden"
          />

          {/* Bottom Shutter & Action Controls */}
          <div className="p-6 pb-8 z-10 bg-[#090708] border-t border-white/5 flex-shrink-0">
            {!previewUrl && !cameraError && (
              <div className="flex justify-center mb-4">
                <div className="flex p-1 rounded-2xl bg-white/8 border border-white/10">
                  <button
                    type="button"
                    onClick={() => setCaptureMode('photo')}
                    disabled={isRecording}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-extrabold font-rounded transition-all cursor-pointer ${
                      captureMode === 'photo'
                        ? 'bg-pink-500 text-white shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Ảnh
                  </button>
                  <button
                    type="button"
                    onClick={() => setCaptureMode('video')}
                    disabled={isRecording}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-extrabold font-rounded transition-all cursor-pointer ${
                      captureMode === 'video'
                        ? 'bg-pink-500 text-white shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    Video
                  </button>
                </div>
              </div>
            )}

            {previewUrl ? (
              <div className="flex items-center gap-3 max-w-[370px] mx-auto">
                <motion.button
                  id="camera-retake-btn"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={resetCameraState}
                  disabled={isUploading}
                  className="shrink-0 w-12 h-12 bg-white/8 hover:bg-white/12 rounded-2xl text-white border border-white/10 flex items-center justify-center cursor-pointer disabled:opacity-50"
                  title="Chụp lại"
                >
                  <RotateCcw className="w-5 h-5 text-zinc-300" />
                </motion.button>

                <motion.button
                  id="camera-post-btn"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleUploadSubmit}
                  disabled={isUploading}
                  className="shimmer-btn flex-1 h-12 bg-gradient-to-r from-pink-500 to-rose-400 text-white font-rounded font-extrabold text-sm rounded-2xl shadow-cute flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                >
                  {isUploading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      <span>Đăng Snap 🚀</span>
                    </>
                  )}
                </motion.button>
              </div>
            ) : (
              <div className="flex items-center justify-between px-6">
                <motion.button
                  id="camera-gallery-btn"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={triggerFileSelect}
                  className="p-3 bg-white/10 hover:bg-white/15 rounded-full text-white border border-white/5 cursor-pointer"
                  aria-label="Upload from gallery"
                >
                  <ImageIcon className="w-5 h-5 text-zinc-300" />
                </motion.button>

                <div className="relative flex items-center justify-center">
                  <div
                    className={`absolute w-22 h-22 rounded-full border pointer-events-none ${
                      isRecording ? 'border-red-500 animate-pulse' : 'border-pink-500/60 shutter-pulse'
                    }`}
                  />

                  <motion.button
                    id="camera-shutter-btn"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleShutter}
                    disabled={!!cameraError}
                    className={`w-18 h-18 rounded-full border-4 flex items-center justify-center p-1 transition-all z-10 cursor-pointer ${
                      cameraError ? 'opacity-40 cursor-not-allowed border-white' : ''
                    } ${
                      captureMode === 'video'
                        ? isRecording
                          ? 'border-red-400 bg-red-500/20'
                          : 'border-white bg-transparent'
                        : 'border-white bg-transparent'
                    }`}
                    aria-label={captureMode === 'video' ? (isRecording ? 'Dừng quay' : 'Bắt đầu quay') : 'Chụp ảnh'}
                  >
                    {captureMode === 'video' ? (
                      <div
                        className={`transition-all ${
                          isRecording
                            ? 'w-7 h-7 bg-red-500 rounded-md'
                            : 'w-full h-full bg-red-500 rounded-full hover:bg-red-400'
                        }`}
                      />
                    ) : (
                      <div className="w-full h-full bg-white rounded-full hover:bg-pink-100 transition-colors" />
                    )}
                  </motion.button>
                </div>

                <motion.button
                  id="camera-switch-btn"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={toggleCamera}
                  disabled={!!cameraError}
                  className={`p-3 rounded-full text-white border border-white/5 cursor-pointer transition-all ${
                    cameraError
                      ? 'opacity-40 pointer-events-none bg-white/5'
                      : 'bg-white/10 hover:bg-white/15'
                  } ${!hasMultipleCameras && !cameraError ? 'ring-1 ring-white/10' : ''}`}
                  aria-label={facingMode === 'user' ? 'Chuyển camera sau' : 'Chuyển camera trước'}
                  title={facingMode === 'user' ? 'Camera sau' : 'Camera trước'}
                >
                  <RefreshCw className="w-5 h-5 text-zinc-300" />
                </motion.button>
              </div>
            )}
          </div>

          {/* Music Selection Bottom Drawer Sheet */}
          <AnimatePresence>
            {isMusicDrawerOpen && (
              <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex flex-col justify-end">
                <div className="absolute inset-0" onClick={closeMusicDrawer} />

                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="relative bg-zinc-950 border-t border-white/10 rounded-t-[2.5rem] p-6 h-[72%] overflow-hidden z-10 flex flex-col space-y-4 shadow-2xl"
                >
                  {/* Drawer Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/5 flex-shrink-0">
                    <h4 className="font-rounded font-extrabold text-white text-md flex items-center space-x-2">
                      <Music className="w-4.5 h-4.5 text-pink-400" />
                      <span>Background Soundtracks 🎵</span>
                    </h4>
                    <button
                      onClick={closeMusicDrawer}
                      className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-4.5 h-4.5" />
                    </button>
                  </div>

                  {/* Deezer Song Search Bar */}
                  <div className="relative flex-shrink-0">
                    <input
                      type="text"
                      placeholder="Search songs or artists... 🔍"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white text-xs font-rounded font-semibold focus:outline-none focus:border-pink-500/50 focus:bg-white/10 transition-all placeholder-zinc-500"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-4 top-3 text-zinc-400 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Scrollable Song Items Container */}
                  <div className="space-y-2.5 overflow-y-auto pr-1 no-scrollbar flex-1 pb-4">
                    {isSearching ? (
                      <div className="flex flex-col items-center justify-center py-12 space-y-3">
                        <div className="w-6 h-6 border-2 border-pink-500/20 border-t-pink-500 rounded-full animate-spin" />
                        <span className="text-[10px] text-zinc-550 font-bold font-rounded tracking-wide uppercase">Searching Music...</span>
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <span className="text-xs text-zinc-500 font-bold font-rounded">No soundtracks found 🥺</span>
                      </div>
                    ) : (
                      <>
                        {/* Clear Selected Song Option */}
                        {!searchQuery && (
                          <button
                            onClick={() => {
                              setSelectedSong(null);
                              closeMusicDrawer();
                            }}
                            className={`w-full flex items-center space-x-3 p-3 rounded-2xl border transition-all text-left cursor-pointer ${
                              !selectedSong
                                ? 'bg-pink-500/15 border-pink-500/40 text-pink-300'
                                : 'bg-white/5 border-white/5 text-zinc-300 hover:bg-white/8'
                            }`}
                          >
                            <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center">
                              <X className="w-4.5 h-4.5 text-zinc-500" />
                            </div>
                            <div className="flex-1">
                              <h5 className="text-xs font-bold font-rounded text-white">No Soundtrack</h5>
                              <p className="text-[10px] text-zinc-500 font-medium">Capture snap in silence</p>
                            </div>
                          </button>
                        )}

                        {/* Song results list */}
                        {searchResults.map((song) => {
                          const isSelected = selectedSong?.previewUrl === song.previewUrl;
                          const isPreviewing = playingPreview?.previewUrl === song.previewUrl;

                          return (
                            <div
                              key={song.previewUrl}
                              onClick={() => handlePlayPreview(song)}
                              className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer text-left ${
                                isSelected
                                  ? 'bg-pink-500/10 border-pink-500/30 text-pink-300'
                                  : 'bg-white/5 border-white/5 text-zinc-300 hover:bg-white/8'
                              }`}
                            >
                              <div className="flex items-center space-x-3 flex-1 min-w-0">
                                {/* Album Art with visualizer overlay */}
                                <div className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
                                  <img src={song.albumArt} alt={song.title} className="w-full h-full object-cover" />
                                  
                                  {/* Playing state visualizer inside album disk */}
                                  {isPreviewing && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                      <div className="flex items-end space-x-[2px] h-3">
                                        {[...Array(3)].map((_, idx) => (
                                          <div
                                            key={idx}
                                            className="w-[1.5px] bg-pink-400 rounded-full visualizer-bar"
                                            style={{ 
                                              height: '100%', 
                                              animationDelay: `${idx * 0.15}s`,
                                              animationDuration: `${0.5 + idx * 0.1}s`
                                            }}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Title / Artist */}
                                <div className="flex-1 min-w-0">
                                  <h5 className="text-xs font-bold font-rounded text-white truncate">{song.title}</h5>
                                  <p className="text-[10px] text-zinc-400 font-medium truncate mt-0.5">{song.artist}</p>
                                </div>
                              </div>

                              {/* Clickable Select button */}
                              <div className="flex items-center pl-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSong(song);
                                    closeMusicDrawer();
                                  }}
                                  className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold font-rounded transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-pink-500 text-white border border-pink-400'
                                      : 'bg-white/10 text-white hover:bg-white/20 border border-white/5'
                                  }`}
                                >
                                  {isSelected ? 'Selected' : 'Use'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
