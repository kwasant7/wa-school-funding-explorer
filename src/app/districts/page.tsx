import type { Metadata } from 'next';
import { Suspense } from 'react';
import DistrictsExplorer from '@/components/DistrictsExplorer';

export const metadata: Metadata = {
  title: 'District Explorer',
  description:
    'Funding and enrollment data for every Washington school district: revenues by source, per-student funding, and student demographics.',
};

export default function DistrictsPage() {
  return (
    <Suspense>
      <DistrictsExplorer />
    </Suspense>
  );
}
