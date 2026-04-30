import { useState, useEffect } from "react";
import type { Bill, LineItem } from "../types";
import { CategoryBadge } from "./CategoryBadge";
import { EditModal } from "./EditModal";
import { ImageZoomOverlay } from "./ImageZoomOverlay";
import { api } from "../api";
import {
  Pencil,
  Calendar,
  Store,
  FileText,
  AlertTriangle,
  ZoomIn,
  Loader2,
  ScanLine,
} from "lucide-react";

interface Props {
  bill: Bill;
  onUpdated: (updated: Bill) => void;
}

export function BillDetail({ bill: initialBill, onUpdated }: Props) {
  const [bill, setBill] = useState(initialBill);
  const [editing, setEditing] = useState(false);
  const [imgZoomed, setImgZoomed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [extractingLineItems, setExtractingLineItems] = useState(false);
  const [lineItemsError, setLineItemsError] = useState<string | null>(null);

  const handleSaved = (updated: Bill) => {
    setBill(updated);
    onUpdated(updated);
  };

  // Poll for line items completion when status is pending
  useEffect(() => {
    if (bill.line_items_status !== "pending") return;
    const interval = setInterval(() => {
      api
        .getBill(bill.id)
        .then((updated) => {
          setBill(updated);
          if (updated.line_items_status !== "pending") {
            clearInterval(interval);
            onUpdated(updated);
          }
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [bill.id, bill.line_items_status, onUpdated]);

  const handleExtractLineItems = async () => {
    setExtractingLineItems(true);
    setLineItemsError(null);
    try {
      const updated = await api.extractLineItems(bill.id);
      setBill(updated);
      onUpdated(updated);
    } catch (err) {
      setLineItemsError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtractingLineItems(false);
    }
  };

  const parsedLineItems: LineItem[] | null = (() => {
    if (!bill.line_items) return null;
    try {
      return JSON.parse(bill.line_items) as LineItem[];
    } catch {
      return null;
    }
  })();

  const isPoor = bill.notes?.startsWith("Image quality issue");

  return (
    <>
      <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
        {/* Left: Image */}
        <div className="relative md:w-1/2 bg-gray-900 flex items-center justify-center overflow-hidden min-h-[200px] md:min-h-0">
          {!imgLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/60 z-10">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-xs">Loading image…</span>
            </div>
          )}
          <img
            src={api.imageUrl(bill.filename)}
            alt={bill.filename}
            className={`w-full h-full object-contain transition-opacity duration-300 ${
              imgLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setImgLoaded(true)}
          />
          {imgLoaded && (
            <button
              onClick={() => setImgZoomed(true)}
              className="absolute top-3 right-3 p-2 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
              title="View full image"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          )}
          <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/50">
            {bill.filename}
          </p>
        </div>

        {/* Right: Details (scrollable) */}
        <div className="md:w-1/2 overflow-y-auto p-5 space-y-4 bg-white">
          {/* Quality warning */}
          {isPoor && (
            <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">{bill.notes}</p>
            </div>
          )}

          {/* Analysis status */}
          {bill.analysis_status !== "success" && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-sm text-gray-500">
                Status:{" "}
                <span className="font-medium capitalize">{bill.analysis_status}</span>
              </p>
            </div>
          )}

          {/* Key fields */}
          <InfoSection title="Bill Details">
            <InfoRow label="Category">
              <CategoryBadge category={bill.category} size="sm" />
            </InfoRow>
            {bill.description && (
              <InfoRow label="Description">{bill.description}</InfoRow>
            )}
            {bill.vendor && (
              <InfoRow label="Vendor">
                <span className="flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-gray-400" />
                  {bill.vendor}
                </span>
              </InfoRow>
            )}
            {bill.amount != null && (
              <InfoRow label="Amount">
                <span className="text-lg font-bold text-gray-900">
                  {bill.currency ?? ""}{bill.amount.toFixed(2)}
                </span>
              </InfoRow>
            )}
            {bill.bill_date && (
              <InfoRow label="Date">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  {bill.bill_date}
                </span>
              </InfoRow>
            )}
          </InfoSection>

          {/* Line Items */}
          <InfoSection title="Line Items">
            {bill.line_items_status === "pending" || extractingLineItems ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Extracting line items…</span>
              </div>
            ) : bill.line_items_status === "success" && parsedLineItems && parsedLineItems.length > 0 ? (
              <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-100/50">
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">
                        Item
                      </th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">
                        Qty
                      </th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">
                        Unit
                      </th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedLineItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 text-gray-800">{item.name}</td>
                        <td className="px-3 py-2 text-gray-600 text-right">
                          {item.quantity ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-600 text-right">
                          {item.unit_price != null
                            ? `${bill.currency ?? ""}${item.unit_price.toFixed(2)}`
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-800 font-medium text-right">
                          {item.total_price != null
                            ? `${bill.currency ?? ""}${item.total_price.toFixed(2)}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : bill.line_items_status === "failed" ? (
              <div className="flex gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="text-sm text-red-700">
                  <p className="font-medium">Could not extract line items</p>
                  <p className="text-red-600/80 mt-0.5">
                    The image may be unclear or this receipt may not have itemized details.
                  </p>
                </div>
              </div>
            ) : (
              <button
                onClick={handleExtractLineItems}
                disabled={extractingLineItems}
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
              >
                <span className="flex items-center justify-center gap-2">
                  <ScanLine className="w-4 h-4" />
                  Extract Line Items
                </span>
              </button>
            )}
            {lineItemsError && (
              <p className="text-sm text-red-500 mt-2">{lineItemsError}</p>
            )}
          </InfoSection>

          {/* Notes */}
          {bill.notes && (
            <InfoSection title="Notes">
              <div className="flex gap-2">
                <FileText className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{bill.notes}</p>
              </div>
            </InfoSection>
          )}

          {/* Metadata */}
          <InfoSection title="File Info">
            <InfoRow label="Filename">{bill.filename}</InfoRow>
            <InfoRow label="Added">{new Date(bill.created_at).toLocaleDateString()}</InfoRow>
            {bill.updated_at !== bill.created_at && (
              <InfoRow label="Updated">
                {new Date(bill.updated_at).toLocaleDateString()}
              </InfoRow>
            )}
          </InfoSection>

          {/* Edit shortcut */}
          <button
            onClick={() => setEditing(true)}
            className="w-full py-2.5 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-600 text-sm font-medium hover:bg-indigo-50 transition-colors"
          >
            <span className="flex items-center justify-center gap-2">
              <Pencil className="w-4 h-4" />
              Edit this bill
            </span>
          </button>
        </div>
      </div>

      {imgZoomed && (
        <ImageZoomOverlay
          filename={bill.filename}
          onClose={() => setImgZoomed(false)}
        />
      )}

      {editing && (
        <EditModal bill={bill} onClose={() => setEditing(false)} onSaved={handleSaved} />
      )}
    </>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{title}</p>
      <div className="bg-gray-50 rounded-xl border border-gray-100 divide-y divide-gray-100">
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2.5">
      <span className="text-xs text-gray-500 font-medium shrink-0 mt-0.5">{label}</span>
      <span className="text-sm text-gray-800 text-right">{children}</span>
    </div>
  );
}
