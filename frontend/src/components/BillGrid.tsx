import React from "react";
import type { Bill } from "../types";
import { BillCard } from "./BillCard";

interface Props {
  bills: Bill[];
  selectedId: number | null;
  onSelectId: (id: number) => void;
}

export const BillGrid = React.memo(function BillGrid({
  bills,
  selectedId,
  onSelectId,
}: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
      {bills.map((bill) => (
        <BillCard
          key={bill.id}
          bill={bill}
          selected={selectedId === bill.id}
          onClick={() => onSelectId(bill.id)}
        />
      ))}
    </div>
  );
});
