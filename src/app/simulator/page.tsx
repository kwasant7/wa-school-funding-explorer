import type { Metadata } from 'next';
import Simulator from '@/components/Simulator';
import JsonLd from '@/components/JsonLd';
import {
  breadcrumbJsonLd,
  pageMetadata,
  webPageJsonLd,
} from '@/lib/site-metadata';

const TITLE = 'Policy Simulator';
const DESCRIPTION =
  'Compare Washington school funding policy ideas for low-income students, English learners, special education, levy equalization, operating costs, and transportation.';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/simulator/',
});

export default function SimulatorPage() {
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({ title: TITLE, description: DESCRIPTION, path: '/simulator/' }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Policy Simulator', path: '/simulator/' },
          ]),
        ]}
      />
      <Simulator />
    </>
  );
}
