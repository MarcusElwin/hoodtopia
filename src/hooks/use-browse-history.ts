"use client";

import { useEffect, useState, useCallback } from "react";

export interface BrowseHistoryItem {
  productId: string;
  productName: string;
  category: string;
  viewedAt: number;
  timeSpent?: number;
}

interface BrowseHistory {
  items: BrowseHistoryItem[];
  viewedProducts: string[]; // Product IDs
  viewedCategories: string[]; // Unique categories
  totalTimeSpent: number;
}

const STORAGE_KEY = "hoodtopia_browse_history";
const MAX_HISTORY_ITEMS = 50;

/**
 * Hook for tracking user browsing history locally
 * Stores product views, time spent, and categories viewed
 */
export function useBrowseHistory() {
  const [history, setHistory] = useState<BrowseHistory>({
    items: [],
    viewedProducts: [],
    viewedCategories: [],
    totalTimeSpent: 0,
  });

  // Load history from localStorage on mount. Reading client-only storage must
  // happen in an effect (it's unavailable during SSR), so the setState here is
  // intentional despite the lint rule.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHistory(parsed);
      } catch (error) {
        console.error("Failed to parse browse history:", error);
      }
    }
  }, []);

  // Save history to localStorage whenever it changes
  const saveHistory = useCallback((newHistory: BrowseHistory) => {
    setHistory(newHistory);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
  }, []);

  /**
   * Track a product view
   */
  const trackProductView = useCallback(
    (productId: string, productName: string, category: string) => {
      const newItem: BrowseHistoryItem = {
        productId,
        productName,
        category,
        viewedAt: Date.now(),
      };

      const updatedItems = [newItem, ...history.items].slice(0, MAX_HISTORY_ITEMS);
      const viewedProducts = Array.from(
        new Set([productId, ...history.viewedProducts])
      );
      const viewedCategories = Array.from(
        new Set([category, ...history.viewedCategories])
      );

      saveHistory({
        items: updatedItems,
        viewedProducts,
        viewedCategories,
        totalTimeSpent: history.totalTimeSpent,
      });
    },
    [history, saveHistory]
  );

  /**
   * Update time spent on a product
   */
  const updateTimeSpent = useCallback(
    (productId: string, timeSpent: number) => {
      const updatedItems = history.items.map((item) =>
        item.productId === productId
          ? { ...item, timeSpent: (item.timeSpent || 0) + timeSpent }
          : item
      );

      saveHistory({
        ...history,
        items: updatedItems,
        totalTimeSpent: history.totalTimeSpent + timeSpent,
      });
    },
    [history, saveHistory]
  );

  /**
   * Get recently viewed products (limit to N most recent)
   */
  const getRecentlyViewed = useCallback(
    (limit: number = 10): BrowseHistoryItem[] => {
      return history.items.slice(0, limit);
    },
    [history.items]
  );

  /**
   * Get most viewed categories
   */
  const getTopCategories = useCallback((): string[] => {
    const categoryCounts = history.items.reduce(
      (acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([category]) => category);
  }, [history.items]);

  /**
   * Clear all browse history
   */
  const clearHistory = useCallback(() => {
    const emptyHistory = {
      items: [],
      viewedProducts: [],
      viewedCategories: [],
      totalTimeSpent: 0,
    };
    saveHistory(emptyHistory);
  }, [saveHistory]);

  /**
   * Get personalization context for AI recommendations
   */
  const getPersonalizationContext = useCallback(() => {
    const recentItems = getRecentlyViewed(10);
    const topCategories = getTopCategories();

    return {
      viewedProducts: recentItems.map((item) => item.productName),
      viewedCategories: topCategories.slice(0, 3),
      timeSpent: history.totalTimeSpent,
      mostViewedProduct: recentItems[0]?.productName,
      preferredCategory: topCategories[0],
    };
  }, [history.totalTimeSpent, getRecentlyViewed, getTopCategories]);

  return {
    history,
    trackProductView,
    updateTimeSpent,
    getRecentlyViewed,
    getTopCategories,
    clearHistory,
    getPersonalizationContext,
  };
}
