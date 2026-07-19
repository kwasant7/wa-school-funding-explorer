import type { Metadata } from 'next';
import Simulator from '@/components/Simulator';

export const metadata: Metadata = {
  title: 'Policy Simulator',
  description:
    'Adjust the levers of Washington’s prototypical school funding model — class sizes, staffing, and per-student dollars — and see what your plan would cost.',
};

export default function SimulatorPage() {
  return <Simulator />;
}
