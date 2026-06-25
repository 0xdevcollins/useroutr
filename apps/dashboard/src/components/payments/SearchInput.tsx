"use client";

import { useState, useEffect } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { Input } from "@useroutr/ui";

interface SearchInputProps {
  placeholder?: string;
  value?: string;
  onSearch: (query: string) => void;
  debounceMs?: number;
}

export function SearchInput({
  placeholder = "Search payments...",
  value = "",
  onSearch,
  debounceMs = 300,
}: SearchInputProps) {
  const [query, setQuery] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, onSearch, debounceMs]);

  return (
    <div className="relative flex-1">
      <MagnifyingGlass
        size={16}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-faint"
      />
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-11 w-full rounded-lg border border-border bg-card pl-10 pr-10 text-[14px] text-foreground placeholder:text-text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-text-faint transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}