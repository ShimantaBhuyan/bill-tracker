import { useState } from "react";
import type { Bill, BillUpdate, Category } from "../types";
import { api } from "../api";
import { X } from "lucide-react";

interface Props {
  bill: Bill;
  onClose: () => void;
  onSaved: (updated: Bill) => void;
}

const CATEGORIES: Category[] = ["food", "fuel", "parking", "others"];

export function EditModal({ bill, onClose, onSaved }: Props) {
  const [form, setForm] = useState<BillUpdate>({
    category: bill.category,
    description: bill.description ?? "",
    vendor: bill.vendor ?? "",
    amount: bill.amount ?? undefined,
    currency: bill.currency ?? "",
    bill_date: bill.bill_date ?? "",
    notes: bill.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Only send non-empty fields
      const payload: BillUpdate = {};
      if (form.category) payload.category = form.category;
      if (form.description) payload.description = form.description;
      if (form.vendor) payload.vendor = form.vendor;
      if (form.amount != null) payload.amount = form.amount;
      if (form.currency) payload.currency = form.currency;
      if (form.bill_date) payload.bill_date = form.bill_date;
      if (form.notes !== undefined) payload.notes = form.notes;

      const updated = await api.updateBill(bill.id, payload);
      onSaved(updated);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Edit Bill</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Category
            </label>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setForm((f) => ({ ...f, category: cat }))}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
                    ${form.category === cat
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
                    }`}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <Field
            label="Description (1-2 words)"
            value={form.description ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, description: v }))}
            placeholder="e.g. Restaurant Bill"
          />

          {/* Vendor */}
          <Field
            label="Vendor / Merchant"
            value={form.vendor ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, vendor: v }))}
            placeholder="e.g. Starbucks"
          />

          {/* Amount + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Amount"
              value={form.amount != null ? String(form.amount) : ""}
              onChange={(v) =>
                setForm((f) => ({ ...f, amount: v ? parseFloat(v) : undefined }))
              }
              placeholder="0.00"
              type="number"
            />
            <Field
              label="Currency"
              value={form.currency ?? ""}
              onChange={(v) => setForm((f) => ({ ...f, currency: v }))}
              placeholder="INR / USD"
            />
          </div>

          {/* Date */}
          <Field
            label="Bill Date"
            value={form.bill_date ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, bill_date: v }))}
            type="date"
          />

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Notes
            </label>
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Add any notes about this bill..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />
    </div>
  );
}
