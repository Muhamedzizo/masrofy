export type ExpenseCategory = {
  id: string;
  label: string;
  icon: string;
  color: string;
  tint: string;
};

export const DEFAULT_CATEGORIES: ExpenseCategory[] = [
  {
    id: "food",
    label: "طعام",
    icon: "restaurant-outline",
    color: "#C65F47",
    tint: "#F8E9E3",
  },
  {
    id: "transport",
    label: "مواصلات",
    icon: "car-outline",
    color: "#4977A8",
    tint: "#E8EFF6",
  },
  {
    id: "bills",
    label: "فواتير",
    icon: "receipt-outline",
    color: "#8B6B35",
    tint: "#F5EEDC",
  },
  {
    id: "shopping",
    label: "تسوق",
    icon: "bag-outline",
    color: "#8B5F8D",
    tint: "#F2E9F3",
  },
  {
    id: "health",
    label: "صحة",
    icon: "heart-outline",
    color: "#B94F68",
    tint: "#F8E8EC",
  },
  {
    id: "other",
    label: "أخرى",
    icon: "ellipsis-horizontal-circle-outline",
    color: "#66736E",
    tint: "#E9EEEB",
  },
];

export function getCategory(categoryId: string): ExpenseCategory {
  return (
    DEFAULT_CATEGORIES.find((category) => category.id === categoryId) ??
    DEFAULT_CATEGORIES[5]
  );
}
