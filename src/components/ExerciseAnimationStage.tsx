import React, { useState, useEffect } from 'react';
import { Play, Dumbbell, AlertCircle, RefreshCw } from 'lucide-react';
import { resolveExerciseMedia } from '../data/curatedExercises';

interface ExerciseAnimationStageProps {
  mediaUrl?: string;
  posterUrl?: string;
  mediaType?: 'image/gif' | 'video/mp4' | 'image/svg+xml' | string;
  name: string;
  size?: 'card' | 'modal' | 'thumb';
  className?: string;
  interactive?: boolean;
  onInspect?: () => void;
}

export const ExerciseAnimationStage: React.FC<ExerciseAnimationStageProps> = ({
  mediaUrl = '',
  posterUrl = '',
  mediaType = 'image/gif',
  name,
  size = 'card',
  className = '',
  interactive = false,
  onInspect,
}) => {
  // Pre-heal any known broken URLs
  const resolved = resolveExerciseMedia({ name, mediaUrl, posterUrl, mediaType: mediaType as any });

  const [activeUrl, setActiveUrl] = useState<string>(resolved.mediaUrl);
  const [activePoster, setActivePoster] = useState<string>(resolved.posterUrl);
  const [activeType, setActiveType] = useState<string>(resolved.mediaType);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [fallbackAttempt, setFallbackAttempt] = useState(0);

  // Sync state whenever props change
  useEffect(() => {
    const res = resolveExerciseMedia({ name, mediaUrl, posterUrl, mediaType: mediaType as any });
    setActiveUrl(res.mediaUrl);
    setActivePoster(res.posterUrl);
    setActiveType(res.mediaType);
    setIsLoaded(false);
    setLoadError(false);
    setFallbackAttempt(0);
  }, [mediaUrl, posterUrl, mediaType, name]);

  const handleMediaError = () => {
    if (fallbackAttempt === 0 && activePoster && activePoster !== activeUrl) {
      // Step 1 fallback: Try poster image
      setFallbackAttempt(1);
      setActiveUrl(activePoster);
      setActiveType('image/gif');
      return;
    }

    if (fallbackAttempt <= 1) {
      // Step 2 fallback: Try default high-speed CDN animation
      setFallbackAttempt(2);
      const safe = resolveExerciseMedia({ name, mediaUrl: '' });
      setActiveUrl(safe.mediaUrl);
      setActivePoster(safe.posterUrl);
      setActiveType('image/gif');
      return;
    }

    // Step 3: All fail, show stylized fallback
    setLoadError(true);
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoadError(false);
    setIsLoaded(false);
    setFallbackAttempt(0);
    const res = resolveExerciseMedia({ name, mediaUrl: '' });
    setActiveUrl(res.mediaUrl);
    setActivePoster(res.posterUrl);
  };

  // Dimensions & styling presets based on container size (pure clean white, no shadows or shading)
  const isModal = size === 'modal';
  const isThumb = size === 'thumb';

  const containerClasses = isModal
    ? 'relative h-80 sm:h-96 w-full bg-white border-b border-[#E6E4DF] flex items-center justify-center p-6 overflow-hidden select-none'
    : isThumb
    ? 'relative w-12 h-12 bg-white rounded border border-[#E6E4DF] flex items-center justify-center overflow-hidden shrink-0'
    : 'relative h-52 w-full bg-white border-b border-[#E6E4DF] flex items-center justify-center overflow-hidden p-3 select-none';

  const mediaClasses = isModal
    ? 'max-h-full max-w-full object-contain'
    : isThumb
    ? 'w-full h-full object-contain p-0.5'
    : 'w-full h-full object-contain p-2';

  return (
    <div
      onClick={onInspect}
      className={`${containerClasses} ${className} ${interactive ? 'cursor-pointer group/stage' : ''}`}
    >

      {/* Loading Shimmer / Spinner */}
      {!isLoaded && !loadError && !isThumb && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px] transition-opacity duration-200">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 text-[#B45309] animate-spin" />
            <span className="text-[11px] font-medium text-[#6E6C67] tracking-wider uppercase">Loading Animation</span>
          </div>
        </div>
      )}

      {/* Render Media (Video or Image/GIF) */}
      {!loadError ? (
        activeType === 'video/mp4' ? (
          <video
            src={activeUrl}
            poster={activePoster}
            controls={isModal}
            autoPlay
            loop
            muted
            playsInline
            onLoadedData={() => setIsLoaded(true)}
            onError={handleMediaError}
            className={`${mediaClasses} transition-transform duration-300 ${
              interactive && !isModal ? 'group-hover/stage:scale-105' : ''
            }`}
          />
        ) : (
          <img
            src={activeUrl}
            alt={name}
            loading={isModal ? 'eager' : 'lazy'}
            referrerPolicy="no-referrer"
            onLoad={() => setIsLoaded(true)}
            onError={handleMediaError}
            className={`${mediaClasses} transition-transform duration-300 ${
              interactive && !isModal ? 'group-hover/stage:scale-105' : ''
            }`}
          />
        )
      ) : (
        /* Rich Graceful Fallback if image/video cannot be fetched */
        <div className="flex flex-col items-center justify-center p-4 text-center z-10 max-w-sm space-y-2">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-[#B45309] shadow-xs">
            <Dumbbell className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#171615]">{name}</div>
            <div className="text-[11px] text-[#6E6C67] mt-0.5">
              Live animation guide · Step-by-step instructions available
            </div>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-[#B45309] bg-white border border-[#D1CFCA] hover:bg-neutral-50 rounded shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reload Animation</span>
          </button>
        </div>
      )}

      {/* Hover "Inspect Animation" pill for cards */}
      {interactive && !isModal && !isThumb && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] opacity-0 group-hover/stage:opacity-100 transition-opacity flex items-center justify-center">
          <span className="px-3.5 py-1.5 bg-white/95 text-[#171615] text-xs font-semibold rounded-lg shadow-md border border-[#E6E4DF] flex items-center gap-1.5 transform translate-y-1 group-hover/stage:translate-y-0 transition-all duration-200">
            <Play className="w-3.5 h-3.5 fill-current text-[#B45309]" />
            <span>Inspect Animation</span>
          </span>
        </div>
      )}

      {/* Hover indicator for thumbnails */}
      {interactive && isThumb && (
        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/stage:opacity-100 flex items-center justify-center transition-opacity">
          <Play className="w-3 h-3 text-white fill-current" />
        </div>
      )}
    </div>
  );
};
