import type { JsonLdGraph } from '@/lib/site-metadata';

/**
 * Emits structured data as a plain script tag.
 *
 * This is a server component, so the JSON is serialized into the exported HTML
 * at build time and costs the browser nothing to run. `<` is escaped because a
 * literal `</script>` inside a JSON string value would otherwise close this
 * tag early and spill the rest of the graph into the document as markup.
 */
export default function JsonLd({ data }: { data: JsonLdGraph | JsonLdGraph[] }) {
  const graphs = Array.isArray(data) ? data : [data];
  return (
    <>
      {graphs.map((graph, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(graph).replace(/</g, '\\u003c'),
          }}
        />
      ))}
    </>
  );
}
