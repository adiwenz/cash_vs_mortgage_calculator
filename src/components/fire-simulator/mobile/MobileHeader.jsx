import React from 'react';
import { Sparkles } from 'lucide-react';

export default function MobileHeader() {
  return (
    <header className="mobile-brand-header">
      <span className="mobile-logo-text">
        <Sparkles size={20} className="mobile-logo-sparkle" fill="#a78bfa" />
        Finley
      </span>
    </header>
  );
}
