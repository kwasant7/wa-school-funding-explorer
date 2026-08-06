import type { Metadata } from 'next';
import Simulator from '@/components/Simulator';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Policy Simulator',
  description:
    'Compare Washington school funding policy ideas for low-income students, English learners, special education, levy equalization, operating costs, and transportation.',
  path: '/simulator/',
});

export default function SimulatorPage() {
  return <Simulator />;
}
