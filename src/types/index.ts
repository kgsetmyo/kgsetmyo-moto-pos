export type UserRole = "ADMIN" | "CASHIER" | "CUSTOMER";
export type PaymentMethod = "CASH" | "MOBILE_BANKING" | "CREDIT";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface ProductSearchResult {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  brand: { name: string };
  category: { name: string };
  total_stock: number;
  selling_price: number;
  is_low_stock: boolean;
  compatibilities?: Array<{
    year: number;
    bike_model: { name: string; bike_brand: { name: string } };
  }>;
}

export interface CartLine {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}
