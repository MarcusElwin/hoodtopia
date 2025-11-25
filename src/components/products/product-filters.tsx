"use client";

import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

interface ProductFiltersProps {
  category: string | undefined;
  onCategoryChange: (category: string | undefined) => void;
}

export function ProductFilters({
  category,
  onCategoryChange,
}: ProductFiltersProps) {
  const { data: categories } = trpc.products.categories.useQuery();

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span className="hidden sm:inline">Filter:</span>
      </div>

      <Select
        value={category || "all"}
        onValueChange={(v) => onCategoryChange(v === "all" ? undefined : v)}
      >
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {categories?.map((cat) => (
            <SelectItem key={cat} value={cat} className="capitalize">
              {cat}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {category && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCategoryChange(undefined)}
          className="text-xs"
        >
          Clear
        </Button>
      )}
    </div>
  );
}
