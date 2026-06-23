// src/data/documents.ts
// Static seed data for the Documents page (replace with Supabase fetch in production)
export interface DocumentRecord {
  registrationDate: string; // ISO date string
  name: string;
  number: string;
  cartNumber: string;
  fileNumber?: string | null;
  fileName?: string | null;
  retentionPeriod: string; // e.g., '7 yrs'
  status: string; // e.g., 'Active' | 'Disposed'
}

export const documents: DocumentRecord[] = [
  {
    registrationDate: '2024-01-15',
    name: 'Annual Financial Report 2023',
    number: 'DOC-FIN-2024-001',
    cartNumber: 'TL-CART-F-001',
    fileNumber: 'FIN-2023-001',
    fileName: 'Annual Reports',
    retentionPeriod: '7 yrs',
    status: 'Active',
  },
  {
    registrationDate: '2024-01-20',
    name: 'Q4 2023 Balance Sheet',
    number: 'DOC-FIN-2024-002',
    cartNumber: 'TL-CART-F-001',
    fileNumber: 'FIN-2023-002',
    fileName: 'Quarterly Reports',
    retentionPeriod: '5 yrs',
    status: 'Active',
  },
  {
    registrationDate: '2023-04-01',
    name: 'Tax Returns 2022',
    number: 'DOC-FIN-2023-055',
    cartNumber: 'TL-CART-F-002',
    fileNumber: 'FIN-2022-055',
    fileName: 'Tax Documents',
    retentionPeriod: '2 yrs',
    status: 'Disposed',
  },
  {
    registrationDate: '2024-04-02',
    name: 'Petty Cash Vouchers Mar 2024',
    number: 'DOC-FIN-2024-003',
    cartNumber: 'TL-CART-F-001',
    fileNumber: null,
    fileName: null,
    retentionPeriod: '3 yrs',
    status: 'Active',
  },
];
