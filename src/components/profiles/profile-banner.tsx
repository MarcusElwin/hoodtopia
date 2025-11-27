"use client";

import { useProfile } from "@/lib/shopper-profiles";
import { Target, BarChart3, Sparkles, DollarSign, Compass, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PROFILE_ICONS = {
  minimalist: Target,
  researcher: BarChart3,
  trendsetter: Sparkles,
  budget_hunter: DollarSign,
  explorer: Compass,
};

export function ProfileBanner() {
  const { config, isProfileActive, clearProfile } = useProfile();

  if (!isProfileActive || !config) return null;

  const Icon = PROFILE_ICONS[config.id];

  return (
    <div
      className={cn(
        "border-b transition-all duration-300",
        config.theme.animations && "animate-in slide-in-from-top"
      )}
      style={{
        backgroundColor: `${config.theme.colors.primary}15`,
        borderColor: `${config.theme.colors.primary}40`,
      }}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: `${config.theme.colors.primary}30`,
              }}
            >
              <Icon
                className="h-5 w-5"
                style={{ color: config.theme.colors.primary }}
              />
            </div>
            <div>
              <p className="text-sm font-medium">
                Shopping as{" "}
                <span
                  className="font-bold"
                  style={{ color: config.theme.colors.primary }}
                >
                  {config.name}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {config.description} • Experience personalized for you
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearProfile}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
