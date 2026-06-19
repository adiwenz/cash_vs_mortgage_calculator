import { useState, useEffect } from 'react';

/**
 * Hook to manage reactive mobile view detection.
 * @returns {Object} { isMobile }
 */
export function useResponsiveFireView() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { isMobile };
}

export default useResponsiveFireView;
