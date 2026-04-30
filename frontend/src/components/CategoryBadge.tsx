import type { Category } from "../types";

const labels: Record<string, string> = {
  food: "Food",
  fuel: "Fuel",
  parking: "Parking",
  others: "Others",
  pending: "Pending",
};

const classes: Record<string, string> = {
  food: "badge-food",
  fuel: "badge-fuel",
  parking: "badge-parking",
  others: "badge-others",
  pending: "badge-pending",
};

interface Props {
  category: Category | "pending" | string;
  size?: "sm" | "md";
}

export function CategoryBadge({ category, size = "md" }: Props) {
  const cls = classes[category] ?? "badge-others";
  const label = labels[category] ?? category;
  const padding = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs";

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${padding} ${cls}`}>
      {label}
    </span>
  );
}
