import type { Metadata } from 'next';
import TakeAction from '@/components/TakeAction';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Take Action',
  description:
    'Find the Washington legislators connected to your school district, review 2026 school-funding bills, and prepare an email or public testimony.',
  path: '/take-action/',
});

export default function TakeActionPage() {
  return <TakeAction />;
}
