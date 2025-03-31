import { useEffect, useRef } from 'react';

interface VideoModalProps {
  videoUrl: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export default function VideoModal({ videoUrl, isOpen, onClose, title }: VideoModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Handle clicking outside the modal to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    
    // Handle ESC key to close the modal
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      // Prevent scrolling of body when modal is open
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Determine if the video is from YouTube
  const isYouTubeVideo = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
  
  // Format YouTube URL for embedding if needed
  let embedUrl = videoUrl;
  if (isYouTubeVideo) {
    // Convert YouTube watch URL to embed URL
    if (videoUrl.includes('youtube.com/watch')) {
      const videoId = new URL(videoUrl).searchParams.get('v');
      embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    } else if (videoUrl.includes('youtu.be')) {
      const videoId = videoUrl.split('/').pop();
      embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div 
        ref={modalRef}
        className="relative bg-black dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white truncate">
            {title || 'Video del Ejercicio'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white focus:outline-none"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="relative w-full aspect-video">
          {isYouTubeVideo ? (
            <iframe
              src={embedUrl}
              className="absolute top-0 left-0 w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          ) : (
            <video
              src={videoUrl}
              className="absolute top-0 left-0 w-full h-full"
              controls
              autoPlay
            ></video>
          )}
        </div>
      </div>
    </div>
  );
} 