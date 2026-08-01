import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Download, Subtitles, Volume1, Languages, Sparkles } from 'lucide-react';
import { Project, TranscriptSegment } from '../../types';

interface CustomVideoPlayerProps {
  project: Project | null;
  onEditSegment?: (segment: TranscriptSegment) => void;
}

export default function CustomVideoPlayer({ project, onEditSegment }: CustomVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [audioTrack, setAudioTrack] = useState<'original' | 'dubbed'>('dubbed');
  const [activeSubtitle, setActiveSubtitle] = useState<string>('');

  // Reset player when project changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setAudioTrack('dubbed');
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [project?.id]);

  // Sync active subtitles based on current video time
  useEffect(() => {
    if (!project || !project.transcript || project.transcript.length === 0) {
      setActiveSubtitle('');
      return;
    }

    const match = project.transcript.find(
      (seg) => currentTime >= seg.start && currentTime <= seg.end
    );

    if (match) {
      setActiveSubtitle(audioTrack === 'original' ? match.text : match.translatedText);
    } else {
      setActiveSubtitle('');
    }
  }, [currentTime, project, audioTrack]);

  if (!project) {
    return (
      <div 
        className="bg-white dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200 dark:border-zinc-800/80 rounded-2xl aspect-video flex flex-col items-center justify-center text-center p-6 shadow-sm dark:shadow-none" 
        id="empty-player-container"
      >
        <Languages className="w-12 h-12 text-zinc-400 dark:text-zinc-600 mb-3 animate-pulse" />
        <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-300">No Video Active</h4>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mt-1 leading-relaxed">
          Select a completed translation project below or upload a video to test the interactive dubbed video player.
        </p>
      </div>
    );
  }

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(err => console.log('Video playback error:', err));
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration || 1);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const seekTime = parseFloat(e.target.value);
    videoRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const vol = parseFloat(e.target.value);
    videoRef.current.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMute = !isMuted;
    videoRef.current.muted = nextMute;
    setIsMuted(nextMute);
  };

  const handleFullscreen = () => {
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  const formatTime = (timeInSecs: number) => {
    const mins = Math.floor(timeInSecs / 60);
    const secs = Math.floor(timeInSecs % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className="bg-white dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm dark:shadow-none relative group" 
      id={`custom-video-player-${project.id}`}
    >
      {/* Real HTML5 Video Container */}
      <div className="relative aspect-video bg-black flex items-center justify-center">
        <video
          id="video-screen"
          ref={videoRef}
          src={project.videoUrl}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onClick={togglePlay}
          playsInline
        />

        {/* Subtitle overlay */}
        {showSubtitles && activeSubtitle && (
          <div className="absolute bottom-16 left-4 right-4 text-center pointer-events-none select-none z-10 animate-fade-in" id="subtitle-track-overlay">
            <span className="bg-zinc-950/90 text-white text-xs sm:text-sm px-3.5 py-1.5 rounded-lg border border-zinc-800 shadow-lg inline-block max-w-[85%] font-medium tracking-wide">
              {activeSubtitle}
            </span>
          </div>
        )}

        {/* Big Play Overlay (Centered) on Pause */}
        {!isPlaying && (
          <button 
            onClick={togglePlay} 
            className="absolute inset-0 m-auto w-14 h-14 bg-emerald-500/95 text-zinc-950 rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all z-10 hover:bg-emerald-400 cursor-pointer"
            aria-label="Play video"
          >
            <Play className="w-6 h-6 fill-zinc-950 ml-1" />
          </button>
        )}

        {/* Audio Track Badge Overlay */}
        <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2">
          <div className="bg-zinc-950/85 backdrop-blur-md border border-zinc-800 rounded-full px-3 py-1 flex items-center gap-1.5 text-[10px] font-mono text-zinc-300">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>TTS ENG: <strong className="text-white uppercase">{project.voiceSettings.voiceName}</strong></span>
          </div>
          <div className="bg-zinc-950/85 backdrop-blur-md border border-zinc-800 rounded-full px-3 py-1 flex items-center gap-1.5 text-[10px] font-mono text-zinc-300">
            <span>DUB TRACK: <strong className="text-emerald-400 uppercase">{audioTrack === 'dubbed' ? 'ACTIVE' : 'MUTED'}</strong></span>
          </div>
        </div>
      </div>

      {/* Control Bar UI */}
      <div className="bg-zinc-50 dark:bg-zinc-950/80 border-t border-zinc-200 dark:border-zinc-800/80 px-4 py-3 space-y-3" id="video-control-bar">
        {/* Timeline Slider */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">{formatTime(currentTime)}</span>
          <input
            id="timeline-scrubber"
            type="range"
            min="0"
            max={duration || 1}
            step="0.01"
            value={currentTime}
            onChange={handleSeek}
            className="w-full accent-emerald-500 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none h-1.5 cursor-pointer"
          />
          <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">{formatTime(duration)}</span>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          {/* Play/Pause & Audio Track Switcher */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={togglePlay}
              className="p-2 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-white rounded-lg transition-colors border border-zinc-200 dark:border-zinc-800 cursor-pointer"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            {/* Muted toggle & Volume slider */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
                aria-label="Mute toggle"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : volume > 0.5 ? <Volume2 className="w-4 h-4" /> : <Volume1 className="w-4 h-4" />}
              </button>
              <input
                id="volume-slider"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 sm:w-20 accent-zinc-500 dark:accent-zinc-350 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none h-1 cursor-pointer"
              />
            </div>

            <div className="hidden sm:block h-4 w-px bg-zinc-200 dark:bg-zinc-800" />

            {/* Subtitle toggle */}
            <button
              onClick={() => setShowSubtitles(!showSubtitles)}
              className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs cursor-pointer ${
                showSubtitles 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                  : 'bg-zinc-200/50 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-500 border border-transparent'
              }`}
            >
              <Subtitles className="w-3.5 h-3.5" />
              <span>CC</span>
            </button>
          </div>

          {/* DUAL AUDIO TRACK TOGGLE */}
          <div className="flex items-center bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 w-full sm:w-auto justify-between shadow-inner">
            <button
              onClick={() => setAudioTrack('original')}
              className={`px-3 py-1 rounded-md text-[11px] font-mono font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                audioTrack === 'original' 
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' 
                  : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              <span>Original Audio</span>
            </button>
            <button
              onClick={() => setAudioTrack('dubbed')}
              className={`px-3 py-1 rounded-md text-[11px] font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                audioTrack === 'dubbed' 
                  ? 'bg-emerald-500 text-zinc-950 shadow-sm' 
                  : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>AI Dub Track</span>
            </button>
          </div>

          {/* Fullscreen & Download */}
          <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
            <button
              onClick={handleFullscreen}
              className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <a
              href={project.videoUrl}
              download={`${project.title.toLowerCase().replace(/\s+/g, '_')}_dubbed.mp4`}
              className="p-2 bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-100 rounded-lg transition-all flex items-center gap-1.5 text-xs cursor-pointer border border-transparent dark:border-zinc-700"
              title="Download Finished Dubbed Video"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline font-mono text-[10px]">Download MP4</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
