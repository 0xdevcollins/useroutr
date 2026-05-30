"use client";

import { forwardRef, useMemo, useState } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "../utils";

const Switch = forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, checked, defaultChecked, onCheckedChange, ...props }, ref) => {
  const [localChecked, setLocalChecked] = useState(Boolean(defaultChecked));

  const isChecked = useMemo(
    () => (typeof checked === "boolean" ? checked : localChecked),
    [checked, localChecked],
  );

  return (
    <SwitchPrimitive.Root
      ref={ref}
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={(nextChecked) => {
        if (typeof checked !== "boolean") {
          setLocalChecked(nextChecked);
        }
        onCheckedChange?.(nextChecked);
      }}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent p-0.5 shadow-sm transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        isChecked
          ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]"
          : "bg-[var(--input)]",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        style={{
          width: 20,
          height: 20,
          borderRadius: 9999,
          backgroundColor: "#ffffff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          transform: `translateX(${isChecked ? 20 : 0}px)`,
          transition: "transform 200ms ease-in-out",
        }}
        className="pointer-events-none block shrink-0"
      />
    </SwitchPrimitive.Root>
  );
});
Switch.displayName = "Switch";

export { Switch };
