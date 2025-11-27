"use client";

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type ProfileType = 'minimalist' | 'researcher' | 'trendsetter' | 'budget_hunter' | 'explorer';

export interface ProfileConfig {
  id: ProfileType;
  name: string;
  icon: string;
  description: string;
  theme: {
    layout: 'single' | 'grid' | 'list' | 'comparison' | 'feed';
    colors: {
      primary: string;
      secondary: string;
      accent: string;
    };
    spacing: 'tight' | 'normal' | 'relaxed';
    animations: boolean;
  };
  aiPersonality: {
    tone: 'direct' | 'detailed' | 'friendly' | 'practical' | 'playful';
    verbosity: 'minimal' | 'moderate' | 'verbose';
    focusAreas: string[];
  };
  uiPreferences: {
    showPrices: 'prominent' | 'normal' | 'subtle';
    showReviews: boolean;
    showSpecs: 'full' | 'summary' | 'hidden';
    quickBuy: boolean;
    imageSize: 'small' | 'medium' | 'large';
  };
}

export const PROFILES: Record<ProfileType, ProfileConfig> = {
  minimalist: {
    id: 'minimalist',
    name: 'The Minimalist',
    icon: '🎯',
    description: 'Clean, fast, essential',
    theme: {
      layout: 'single',
      colors: {
        primary: '#000000',
        secondary: '#FFFFFF',
        accent: '#808080',
      },
      spacing: 'tight',
      animations: false,
    },
    aiPersonality: {
      tone: 'direct',
      verbosity: 'minimal',
      focusAreas: ['essentials', 'speed', 'clarity'],
    },
    uiPreferences: {
      showPrices: 'prominent',
      showReviews: false,
      showSpecs: 'hidden',
      quickBuy: true,
      imageSize: 'medium',
    },
  },

  researcher: {
    id: 'researcher',
    name: 'The Researcher',
    icon: '📊',
    description: 'Data-driven, detailed',
    theme: {
      layout: 'comparison',
      colors: {
        primary: '#1e40af',
        secondary: '#3b82f6',
        accent: '#60a5fa',
      },
      spacing: 'normal',
      animations: false,
    },
    aiPersonality: {
      tone: 'detailed',
      verbosity: 'verbose',
      focusAreas: ['specifications', 'comparisons', 'data', 'materials'],
    },
    uiPreferences: {
      showPrices: 'normal',
      showReviews: true,
      showSpecs: 'full',
      quickBuy: false,
      imageSize: 'small',
    },
  },

  trendsetter: {
    id: 'trendsetter',
    name: 'The Trendsetter',
    icon: '✨',
    description: 'Style-focused, visual',
    theme: {
      layout: 'grid',
      colors: {
        primary: '#ec4899',
        secondary: '#f472b6',
        accent: '#fbbf24',
      },
      spacing: 'relaxed',
      animations: true,
    },
    aiPersonality: {
      tone: 'friendly',
      verbosity: 'moderate',
      focusAreas: ['style', 'trends', 'aesthetics', 'outfits'],
    },
    uiPreferences: {
      showPrices: 'subtle',
      showReviews: true,
      showSpecs: 'summary',
      quickBuy: false,
      imageSize: 'large',
    },
  },

  budget_hunter: {
    id: 'budget_hunter',
    name: 'The Budget Hunter',
    icon: '💰',
    description: 'Value-focused, deals',
    theme: {
      layout: 'list',
      colors: {
        primary: '#16a34a',
        secondary: '#22c55e',
        accent: '#fbbf24',
      },
      spacing: 'tight',
      animations: false,
    },
    aiPersonality: {
      tone: 'practical',
      verbosity: 'moderate',
      focusAreas: ['price', 'value', 'deals', 'savings'],
    },
    uiPreferences: {
      showPrices: 'prominent',
      showReviews: true,
      showSpecs: 'summary',
      quickBuy: true,
      imageSize: 'small',
    },
  },

  explorer: {
    id: 'explorer',
    name: 'The Explorer',
    icon: '🚀',
    description: 'Discovery, variety',
    theme: {
      layout: 'feed',
      colors: {
        primary: '#7c3aed',
        secondary: '#a78bfa',
        accent: '#ec4899',
      },
      spacing: 'relaxed',
      animations: true,
    },
    aiPersonality: {
      tone: 'playful',
      verbosity: 'moderate',
      focusAreas: ['discovery', 'variety', 'surprise', 'exploration'],
    },
    uiPreferences: {
      showPrices: 'normal',
      showReviews: false,
      showSpecs: 'summary',
      quickBuy: false,
      imageSize: 'large',
    },
  },
};

interface ProfileContextType {
  currentProfile: ProfileType | null;
  config: ProfileConfig | null;
  setProfile: (profile: ProfileType) => void;
  clearProfile: () => void;
  isProfileActive: boolean;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [currentProfile, setCurrentProfile] = useState<ProfileType | null>(null);

  // Load profile from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('hoodtopia_shopper_profile');
    if (stored && stored in PROFILES) {
      setCurrentProfile(stored as ProfileType);
    }
  }, []);

  const config = currentProfile ? PROFILES[currentProfile] : null;

  const setProfile = useCallback((profile: ProfileType) => {
    setCurrentProfile(profile);
    localStorage.setItem('hoodtopia_shopper_profile', profile);
    console.log(`[Shopper Profile] Switched to: ${PROFILES[profile].name}`);
  }, []);

  const clearProfile = useCallback(() => {
    setCurrentProfile(null);
    localStorage.removeItem('hoodtopia_shopper_profile');
    console.log('[Shopper Profile] Cleared');
  }, []);

  return (
    <ProfileContext.Provider
      value={{
        currentProfile,
        config,
        setProfile,
        clearProfile,
        isProfileActive: currentProfile !== null,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return context;
}
