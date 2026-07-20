import type { Metadata } from 'next';
import Simulator from '@/components/Simulator';

export const metadata: Metadata = {
  title: 'Policy Simulator',
  description:
    'Compare Washington school funding policy ideas for low-income students, English learners, special education, levy equalization, operating costs, and transportation.',
};

export default function SimulatorPage() {
  return <Simulator />;
}
