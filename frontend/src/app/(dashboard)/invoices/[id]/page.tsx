import InvoiceDetailClient from './InvoiceDetailClient';

export function generateStaticParams() {
  return [];
}

export default function Page({ params }: { params: { id: string } }) {
  return <InvoiceDetailClient params={params} />;
}
