import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-call";
import { Megaphone } from "lucide-react";

interface GeneralSettings {
  serviceSlot1Label: string;
  serviceSlot1Time: string;
  serviceSlot2Label: string;
  serviceSlot2Time: string;
  supportPhone: string;
  announcementBanner: string;
}

export function useGeneralSettings() {
  return useQuery<GeneralSettings>({
    queryKey: ["general-settings"],
    queryFn: () => apiGet<GeneralSettings>("/settings/general"),
    staleTime: 30 * 1000, // cache 30 s — short TTL so settings changes propagate quickly across sessions
  });
}

/**
 * Displays the announcement/welcome banner set by the super admin.
 * Renders nothing when the banner text is empty.
 */
export default function AnnouncementBanner() {
  const { data } = useGeneralSettings();
  const text = data?.announcementBanner?.trim();
  if (!text) return null;

  return (
    <div className="w-full flex items-start gap-3 px-4 py-3 rounded-2xl mb-4 bg-amber-50 border border-amber-200">
      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center mt-0.5">
        <Megaphone className="w-4 h-4 text-amber-600" />
      </div>
      <p className="text-sm text-amber-800 font-medium leading-relaxed">{text}</p>
    </div>
  );
}
