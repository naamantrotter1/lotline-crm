// HLS video player using hls.js (falls back to native HLS on Safari).
// Fires onTimeUpdate every ~10s, onLoadedMetadata when duration is known,
// and onEnded when the video reaches the end. Resumes at startSeconds.
import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

export default function VideoPlayer({
  manifestUrl,
  startSeconds = 0,
  onTimeUpdate,
  onLoadedMetadata,
  onEnded,
  className = '',
  autoPlay = false,
}) {
  const videoRef = useRef(null);
  const hlsRef   = useRef(null);
  const lastReportedRef = useRef(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !manifestUrl) return;

    // Tear down any previous instance
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch { /* noop */ }
      hlsRef.current = null;
    }

    if (Hls.isSupported() && !manifestUrl.endsWith('.mp4')) {
      const hls = new Hls({ maxBufferLength: 30 });
      hls.loadSource(manifestUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;
    } else {
      // Safari / Edge — native HLS, or a direct .mp4
      video.src = manifestUrl;
    }

    const handleLoaded = () => {
      if (startSeconds > 0 && Number.isFinite(video.duration)) {
        try { video.currentTime = Math.min(startSeconds, video.duration - 1); } catch { /* noop */ }
      }
      onLoadedMetadata?.({ duration: video.duration });
    };
    const handleTime = () => {
      const t = video.currentTime;
      if (Math.abs(t - lastReportedRef.current) >= 10 || (video.duration && t / video.duration >= 0.9 && lastReportedRef.current < t)) {
        lastReportedRef.current = t;
        onTimeUpdate?.({ currentTime: t, duration: video.duration });
      }
    };
    const handleEnded = () => onEnded?.();

    video.addEventListener('loadedmetadata', handleLoaded);
    video.addEventListener('timeupdate',     handleTime);
    video.addEventListener('ended',          handleEnded);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoaded);
      video.removeEventListener('timeupdate',     handleTime);
      video.removeEventListener('ended',          handleEnded);
      // Flush one last progress update on unmount
      if (lastReportedRef.current !== video.currentTime) {
        onTimeUpdate?.({ currentTime: video.currentTime, duration: video.duration, flush: true });
      }
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch { /* noop */ }
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifestUrl]);

  return (
    <video
      ref={videoRef}
      className={`w-full bg-black rounded-2xl ${className}`}
      controls
      autoPlay={autoPlay}
      playsInline
    />
  );
}
