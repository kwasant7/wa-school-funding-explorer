import type { Metadata } from 'next';
import TakeAction from '@/components/TakeAction';

export const metadata: Metadata = {
  title: 'Take Action',
  description:
    'Find the Washington legislators connected to your school district, review 2026 school-funding bills, and prepare an email or public testimony.',
};

export default function TakeActionPage() {
  return <TakeAction />;
}
