export interface Invoice {
  id: string;
  customer: string;
  date: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Overdue';
  items: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  sku: string;
  category: string;
  stock: number;
  minStock: number;
  price: number;
  status: 'In Stock' | 'Low Stock' | 'Critical' | 'Verified';
  image: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  initials: string;
}
