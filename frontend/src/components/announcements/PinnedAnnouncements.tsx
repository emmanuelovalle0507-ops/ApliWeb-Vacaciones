"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Megaphone,
  PartyPopper,
  UserPlus,
  X,
  Pin,
  Globe,
} from "lucide-react";
import api from "@/api/client";
import { useAuth } from "@/providers/AuthProvider";
import type { AnnouncementType } from "@/types";

const ICON_MAP: Record<AnnouncementType, React.ReactNode> = {
  URGENT: <AlertTriangle size={18} />,
  NEW_EMPLOYEE: <UserPlus size={18} />,
  CELEBRATION: <PartyPopper size={18} />,
  GENERAL: <Megaphone size={18} />,
};

const COLOR_MAP: Record<AnnouncementType, { bg: string; border: string; icon: string; badge: string }> = {
  URGENT: {
    bg: "bg-gradient-to-r from-red-50 to-red-100/50",
    border: "border-red-200",
    icon: "text-red-500 bg-red-100",
    badge: "bg-red-500",
  },
  NEW_EMPLOYEE: {
    bg: "bg-gradient-to-r from-emerald-50 to-emerald-100/50",
    border: "border-emerald-200",
    icon: "text-emerald-600 bg-emerald-100",
    badge: "bg-emerald-500",
  },
  CELEBRATION: {
    bg: "bg-gradient-to-r from-amber-50 to-yellow-100/50",
    border: "border-amber-200",
    icon: "text-amber-600 bg-amber-100",
    badge: "bg-amber-500",
  },
  GENERAL: {
    bg: "bg-gradient-to-r from-blue-50 to-blue-100/50",
    border: "border-blue-200",
    icon: "text-blue-600 bg-blue-100",
    badge: "bg-blue-500",
  },
};

export default function PinnedAnnouncements() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: pinned = [] } = useQuery({
    queryKey: ["announcements.pinned", user?.id],
    queryFn: () => api.announcements.listPinned(),
    enabled: !!user,
    refetchInterval: 60000,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => api.announcements.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements.pinned"] });
      qc.invalidateQueries({ queryKey: ["announcements"] });
    },
  });

  if (pinned.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {pinned.map((ann) => {
        const colors = COLOR_MAP[ann.type] || COLOR_MAP.GENERAL;
        const icon = ICON_MAP[ann.type] || ICON_MAP.GENERAL;

        return (
          <div
            key={ann.id}
            className={`relative border rounded-xl p-4 ${colors.bg} ${colors.border} shadow-sm transition-all hover:shadow-md`}
          >
            {/* Pin badge */}
            <div className="absolute -top-1.5 -left-1.5">
              <div className={`${colors.badge} text-white rounded-full p-1 shadow-sm`}>
                <Pin size={10} />
              </div>
            </div>

            {/* Dismiss button */}
            {!ann.isRead && (
              <button
                onClick={() => markReadMut.mutate(ann.id)}
                className="absolute top-2 right-2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-colors"
                title="Marcar como leído"
              >
                <X size={14} />
              </button>
            )}

            <div className="flex items-start gap-3">
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${colors.icon} shrink-0`}>
                {icon}
              </div>
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-sm font-bold text-gray-900 truncate">{ann.title}</h4>
                  {!ann.isRead && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                  )}
                </div>
                <p className="text-xs text-gray-600 line-clamp-2">{ann.body}</p>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400">
                  {ann.authorName && <span>por {ann.authorName}</span>}
                  {ann.isBroadcast && (
                    <span className="flex items-center gap-0.5">
                      <Globe size={9} /> Todos
                    </span>
                  )}
                  {!ann.isBroadcast && ann.teamNames.length > 0 && (
                    <span>{ann.teamNames.join(", ")}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
