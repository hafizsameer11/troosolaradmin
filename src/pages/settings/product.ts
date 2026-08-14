export interface ProductCategory {
  id: string;
  categoryName: string;
  image: string;
  dateCreated: string;
  status: 'Active' | 'Hidden';
  isSelected?: boolean;
}

export interface Brand {
  id: string;
  brandName: string;
  category: string;
  categoryIds?: string[];
  categoryLabels?: string[];
  dateCreated: string;
  status: 'Active' | 'Pending';
  isSelected?: boolean;
  sortOrder?: number;
}

export const productCategories: ProductCategory[] = [
  {
    id: '1',
    categoryName: 'Solar Panel',
    image: '/assets/images/category.png', // Replace with your actual solar panel image path
    dateCreated: '05-07-25/07:22AM',
    status: 'Active',
    isSelected: false
  },
  {
    id: '2',
    categoryName: 'Inverter',
    image: '/assets/images/category.png', // Replace with your actual inverter image path
    dateCreated: '05-07-25/07:22AM',
    status: 'Hidden',
    isSelected: false
  },
  {
    id: '3',
    categoryName: 'Batteries',
    image: '/assets/images/category.png', // Replace with your actual batteries image path
    dateCreated: '05-07-25/07:22AM',
    status: 'Hidden',
    isSelected: false
  }
];

export const brands: Brand[] = [
  {
    id: '1',
    brandName: 'NewMann',
    category: 'Inverter',
    dateCreated: '05-07-25/07:22AM',
    status: 'Active',
    isSelected: false
  },
  {
    id: '2',
    brandName: 'NewMann',
    category: 'Inverter',
    dateCreated: '05-07-25/07:22AM',
    status: 'Active',
    isSelected: false
  },
  {
    id: '3',
    brandName: 'NewMann',
    category: 'Inverter',
    dateCreated: '05-07-25/07:22AM',
    status: 'Active',
    isSelected: false
  }
];
