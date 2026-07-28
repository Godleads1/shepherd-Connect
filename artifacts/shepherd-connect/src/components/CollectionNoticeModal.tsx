import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-call";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { MapPin, ExternalLink, Printer, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface LocationSettings {
  churchName: string;
  address: string;
  mapsUrl: string;
}

interface CollectionNoticeModalProps {
  open: boolean;
  onClose: () => void;
  familyCode?: string;
  childNames?: string[];
}

export default function CollectionNoticeModal({
  open,
  onClose,
  familyCode,
  childNames = [],
}: CollectionNoticeModalProps) {
  const { data: location, isLoading } = useQuery<LocationSettings>({
    queryKey: ["settings-location"],
    queryFn: () => apiGet<LocationSettings>("/settings/location"),
    staleTime: 5 * 60 * 1000,
  });

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=480,height=700");
    if (!printWindow || !location) return;

    const qrCanvas = document.getElementById("collection-notice-qr") as HTMLCanvasElement | null;
    const svgEl = document.getElementById("collection-notice-qr-svg");
    let qrDataUrl = "";
    if (qrCanvas) {
      qrDataUrl = qrCanvas.toDataURL("image/png");
    } else if (svgEl) {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      qrDataUrl = "data:image/svg+xml;base64," + btoa(svgData);
    }

    const children = childNames.length > 0
      ? `<p style="margin:0 0 4px;font-size:14px;color:#64748b;">Children: <strong style="color:#1e3a8a;">${childNames.join(", ")}</strong></p>`
      : "";
    const code = familyCode
      ? `<p style="margin:0 0 4px;font-size:14px;color:#64748b;">Family Code: <strong style="font-family:monospace;color:#1e3a8a;">${familyCode}</strong></p>`
      : "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Collection Notice</title>
        <meta charset="utf-8"/>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Inter', Arial, sans-serif; background: #fff; color: #111; }
          .slip { max-width: 400px; margin: 32px auto; padding: 28px; border: 2px solid #1e3a8a; border-radius: 16px; }
          .header { text-align: center; margin-bottom: 20px; }
          .badge { display: inline-block; background: #eff6ff; color: #1e3a8a; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; margin-bottom: 10px; }
          h1 { font-size: 22px; font-weight: 800; color: #1e3a8a; margin-bottom: 4px; }
          .subtitle { font-size: 12px; color: #94a3b8; }
          .divider { border: none; border-top: 1.5px dashed #cbd5e1; margin: 16px 0; }
          .location { display: flex; gap: 10px; align-items: flex-start; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 16px; }
          .pin { font-size: 20px; }
          .loc-name { font-size: 15px; font-weight: 700; color: #1e3a8a; margin-bottom: 2px; }
          .loc-addr { font-size: 13px; color: #64748b; }
          .qr-section { text-align: center; margin: 16px 0; }
          .qr-section img { width: 160px; height: 160px; }
          .qr-label { font-size: 11px; color: #94a3b8; margin-top: 6px; }
          .family-info { font-size: 13px; color: #64748b; margin-bottom: 4px; }
          .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 16px; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="slip">
          <div class="header">
            <div class="badge">📋 Collection Notice</div>
            <h1>Child Pick-Up Slip</h1>
            <p class="subtitle">Show this to the teacher at dismissal</p>
          </div>
          <hr class="divider"/>
          <div class="location">
            <div class="pin">📍</div>
            <div>
              <div class="loc-name">${location.churchName}</div>
              <div class="loc-addr">${location.address}</div>
            </div>
          </div>
          ${children}
          ${code}
          <hr class="divider"/>
          <div class="qr-section">
            ${qrDataUrl ? `<img src="${qrDataUrl}" alt="Map QR Code"/>` : ""}
            <div class="qr-label">Scan to open in Google Maps</div>
          </div>
          <div class="footer">Shepherd Connect · Powered by grace</div>
        </div>
        <script>window.onload = () => { window.print(); window.close(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#1e3a8a]" />
            Collection Notice
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : location ? (
          <div className="flex flex-col gap-4 py-1">
            {/* Location card */}
            <div
              className="rounded-2xl p-4"
              style={{ background: "linear-gradient(135deg, #172554 0%, #1e3a8a 100%)", color: "white" }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#f59e0b" }}>
                Pickup / Drop-off Location
              </p>
              <p className="text-base font-bold leading-snug">{location.churchName}</p>
              <p className="text-sm text-white/70 mt-0.5">{location.address}</p>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center gap-2">
              <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-inner">
                <QRCodeSVG
                  id="collection-notice-qr-svg"
                  value={location.mapsUrl}
                  size={180}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <p className="text-xs text-gray-400 text-center">Scan to open in Google Maps</p>
            </div>

            {/* Family info */}
            {(familyCode || childNames.length > 0) && (
              <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 space-y-1">
                {childNames.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Children: <span className="font-semibold text-gray-800">{childNames.join(", ")}</span>
                  </p>
                )}
                {familyCode && (
                  <p className="text-xs text-gray-500">
                    Family Code: <span className="font-mono font-bold text-[#1e3a8a]">{familyCode}</span>
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <a
                href={location.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                style={{ background: "#f59e0b", color: "#172554" }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Get Directions
              </a>
              <Button
                onClick={handlePrint}
                className="flex-1 gap-1.5 text-xs"
                style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}
              >
                <Printer className="w-3.5 h-3.5" />
                Print Slip
              </Button>
              <Button variant="outline" onClick={onClose} className="px-3">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">Location details not available.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
