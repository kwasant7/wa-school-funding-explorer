import type { Metadata } from 'next';
import { Suspense } from 'react';
import DistrictsExplorer from '@/components/DistrictsExplorer';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = pageMetadata({
  title: 'District Explorer',
  description:
    'Funding and enrollment data for every Washington school district: revenues by source, per-student funding, and student demographics.',
  path: '/districts/',
});

export default function DistrictsPage() {
  return (
    <Suspense>
      <DistrictsExplorer />
    </Suspense>
  );
}
