"use client";

import { useProfile, PROFILES } from "@/lib/shopper-profiles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  X,
  Target,
  BarChart3,
  Sparkles as SparklesIcon,
  DollarSign,
  Compass,
  User,
  type LucideIcon
} from "lucide-react";

// Profile icon mapping
const PROFILE_ICONS: Record<string, LucideIcon> = {
  default: User,
  minimalist: Target,
  researcher: BarChart3,
  trendsetter: SparklesIcon,
  budget_hunter: DollarSign,
  explorer: Compass,
};

export function ProfileSelector() {
  const { currentProfile, setProfile, clearProfile, isProfileActive, config } = useProfile();

  const Icon = currentProfile ? PROFILE_ICONS[currentProfile] : null;

  return (
    <div className="flex items-center gap-2">
      <Select
        value={currentProfile || "default"}
        onValueChange={(value) => {
          if (value === "default") {
            clearProfile();
          } else {
            setProfile(value as keyof typeof PROFILES);
          }
        }}
      >
        <SelectTrigger className="w-[240px]">
          <SelectValue placeholder="Choose shopping style" />
        </SelectTrigger>
        <SelectContent>
          {/* Default Mode */}
          <SelectItem value="default">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full flex items-center justify-center bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium">Default Mode</span>
                <span className="text-xs text-muted-foreground">
                  Standard shopping experience
                </span>
              </div>
            </div>
          </SelectItem>

          {/* Profile Personas */}
          {Object.values(PROFILES).map((profile) => {
            const ProfileIcon = PROFILE_ICONS[profile.id];
            return (
              <SelectItem key={profile.id} value={profile.id}>
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: `${profile.theme.colors.primary}20`,
                    }}
                  >
                    <ProfileIcon
                      className="h-4 w-4"
                      style={{ color: profile.theme.colors.primary }}
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">{profile.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {profile.description}
                    </span>
                  </div>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {isProfileActive && (
        <Button
          variant="ghost"
          size="icon"
          onClick={clearProfile}
          title="Clear profile"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
