import type { Metadata } from 'next';
import TakeAction from '@/components/TakeAction';
import JsonLd from '@/components/JsonLd';
import {
  breadcrumbJsonLd,
  pageMetadata,
  webPageJsonLd,
} from '@/lib/site-metadata';

const TITLE = 'Take Action';
const DESCRIPTION =
  "Find the Washington legislators connected to your school district, see your district's funding brief, and review 2026 school-funding bills.";

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/take-action/',
});

export default function TakeActionPage() {
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({ title: TITLE, description: DESCRIPTION, path: '/take-action/' }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Take Action', path: '/take-action/' },
          ]),
        ]}
      />
      <TakeAction />
    </>
  );
}
