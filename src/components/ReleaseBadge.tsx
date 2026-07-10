"use client";

import { ReleaseState } from "@/lib/types";

interface ReleaseBadgeProps {
  state: ReleaseState;
}

const STATE_CONFIG: Record<ReleaseState, { label: string; className: string }> = {
  [ReleaseState.CREATED]: {
    label: "Created",
    className: "bg-gray-600 text-gray-200",
  },
  [ReleaseState.STAGING]: {
    label: "Staging",
    className: "bg-blue-600 text-blue-100",
  },
  [ReleaseState.LIVE]: {
    label: "Live",
    className: "bg-green-600 text-green-100",
  },
  [ReleaseState.HALTED]: {
    label: "Halted",
    className: "bg-yellow-600 text-yellow-100",
  },
  [ReleaseState.DISABLED]: {
    label: "Disabled",
    className: "bg-red-600 text-red-100",
  },
  [ReleaseState.DELETED]: {
    label: "Deleted",
    className: "bg-red-900 text-red-200",
  },
};

export default function ReleaseBadge({ state }: ReleaseBadgeProps) {
  const config = STATE_CONFIG[state] || { label: "Unknown", className: "bg-gray-600 text-gray-200" };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
