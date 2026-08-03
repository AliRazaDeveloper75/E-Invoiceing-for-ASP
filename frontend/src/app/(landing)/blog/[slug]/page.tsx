import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Metadata } from 'next';
import {
  ArrowLeft,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowRight,
  List,
  FileText,
} from 'lucide-react';
import { POSTS, getRelatedPosts } from '@/data/blog';
import { getTagVisual } from '@/data/blog-visuals';
import { ShareBar } from '@/components/blog/ShareBar';
import { ReadingProgress } from '@/components/blog/ReadingProgress';

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

interface Heading {
  level: number;
  text: string;
  id: string;
}

function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  for (const line of markdown.split('\n')) {
    const m = line.match(/^(#{2,3})\s+(.+)$/);
    if (m) {
      headings.push({ level: m[1].length, text: m[2].trim(), id: slugify(m[2].trim()) });
    }
  }
  return headings;
}

export function generateStaticParams() {
  return POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = POSTS.find((p) => p.slug === params.slug);
  if (!post) return {};
  return {
    title: `${post.title} | E-Numerak Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.date,
    },
  };
}

export default function BlogDetailPage({ params }: { params: { slug: string } }) {
  const post = POSTS.find((p) => p.slug === params.slug);
  if (!post) notFound();

  const related = getRelatedPosts(post);
  const headings = extractHeadings(post.content);
  const visual = getTagVisual(post.tag);
  const Icon = visual.icon;

  const index = POSTS.findIndex((p) => p.slug === post.slug);
  const prev = POSTS[index - 1];
  const next = POSTS[index + 1];

  return (
    <div dir="ltr" className="min-h-screen">
      <ReadingProgress />

      {/* Back bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <nav className="flex items-center gap-2 text-xs text-gray-400">
            <Link href="/" className="hover:text-gray-700 transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link href="/blog" className="hover:text-gray-700 transition-colors">
              Blog
            </Link>
            <span>/</span>
            <span className="text-gray-700">{post.tag}</span>
          </nav>
        </div>
      </div>

      {/* Hero header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0a1628] via-[#0f1f3d] to-[#1e3a5f]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 right-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:24px_24px] opacity-60" />
        </div>
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 text-center">
          {/* Tag badge with icon */}
          <div className="inline-flex mb-8">
            <span className="inline-flex items-center gap-2.5 rounded-full bg-white/10 pl-1.5 pr-4 py-1.5 ring-1 ring-white/15 backdrop-blur-md shadow-lg shadow-black/10">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full shadow-md ${visual.bg}`}>
                <Icon className="h-3.5 w-3.5 text-white" strokeWidth={2.25} />
              </span>
              <span className="text-xs font-semibold tracking-wide text-white">
                {post.tag}
              </span>
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-[1.2] md:leading-[1.15] tracking-tight">
            {post.title}
          </h1>

          <p className="max-w-2xl mx-auto text-base md:text-lg text-blue-200/70 mb-10">
            {post.excerpt}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-blue-100 ring-1 ring-white/10">
              <Calendar className="h-4 w-4 text-cyan-300" />
              {post.date}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-blue-100 ring-1 ring-white/10">
              <Clock className="h-4 w-4 text-cyan-300" />
              {post.readTime}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-blue-100 ring-1 ring-white/10">
              <FileText className="h-4 w-4 text-cyan-300" />
              {headings.length} sections
            </span>
          </div>
        </div>
      </section>

      {/* Body */}
      <article className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-14">
          {/* Main column */}
          <div className="min-w-0">
            <div className="max-w-3xl">
              <div className="flex items-center justify-between mb-8">
                <ShareBar title={post.title} />
              </div>

              <div className="prose prose-gray max-w-none
                prose-headings:text-gray-900 prose-headings:tracking-tight
                prose-h2:mt-12 prose-h2:mb-5 prose-h2:text-2xl prose-h2:font-bold prose-h2:text-gray-900 prose-h2:border-l-4 prose-h2:border-blue-500 prose-h2:pl-4
                prose-h3:mt-8 prose-h3:mb-3 prose-h3:text-xl prose-h3:font-semibold prose-h3:text-gray-900
                prose-p:text-gray-600 prose-p:leading-[1.85] prose-p:mb-5 prose-p:text-[16px]
                prose-strong:text-gray-900 prose-strong:font-semibold
                prose-ul:my-6 prose-ul:space-y-2.5 prose-ol:my-6 prose-ol:space-y-2.5
                prose-li:text-gray-600 prose-li:leading-relaxed prose-li:marker:text-blue-500
                prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h2: ({ children }) => (
                      <h2 id={slugify(String(children))} className="scroll-mt-28">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 id={slugify(String(children))} className="scroll-mt-28">
                        {children}
                      </h3>
                    ),
                    li: ({ children }) => (
                      <li className="flex items-start gap-2.5 [&>p]:m-0 [&>p]:leading-relaxed [&>ul]:mt-2">
                        <span className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" aria-hidden="true" />
                        <span className="min-w-0 flex-1">{children}</span>
                      </li>
                    ),
                  }}
                >
                  {post.content}
                </ReactMarkdown>
              </div>
            </div>

            {/* Prev / Next */}
            {(prev || next) && (
              <div className="max-w-3xl mt-14 grid sm:grid-cols-2 gap-4">
                {prev ? (
                  <Link
                    href={`/blog/${prev.slug}`}
                    className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 hover:shadow-lg hover:border-gray-300 transition-all duration-300"
                  >
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 mb-2">
                      <ArrowLeft className="h-3 w-3 group-hover:-translate-x-0.5 transition-transform" />
                      Previous
                    </span>
                    <span className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors line-clamp-2">
                      {prev.title}
                    </span>
                  </Link>
                ) : (
                  <div className="hidden sm:block" />
                )}
                {next && (
                  <Link
                    href={`/blog/${next.slug}`}
                    className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 hover:shadow-lg hover:border-gray-300 transition-all duration-300 sm:text-right"
                  >
                    <span className="inline-flex items-center justify-end gap-1 text-xs font-semibold text-blue-600 mb-2">
                      Next
                      <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                    <span className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors line-clamp-2">
                      {next.title}
                    </span>
                  </Link>
                )}
              </div>
            )}

            {/* CTA banner */}
            <div className="max-w-3xl mt-10 relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a1628] via-[#0f1f3d] to-[#1e3a5f] p-8 md:p-10">
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-blue-500/20 blur-3xl" />
              <div className="absolute -bottom-12 -left-8 w-44 h-44 rounded-full bg-indigo-500/20 blur-3xl" />
              <div className="relative">
                <h3 className="text-xl md:text-2xl font-bold text-white mb-3">
                  Ready to simplify your e-invoicing?
                </h3>
                <p className="text-sm md:text-base text-blue-200/70 max-w-md mb-6">
                  Let E-Numerak handle structured invoice generation, validation and ASP transmission so your team can focus on the business.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/book-demo"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white shadow-lg shadow-blue-500/25 transition-all duration-200 hover:scale-[1.03]"
                  >
                    Book a Demo
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/contact"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-blue-200 bg-white/10 ring-1 ring-white/20 hover:bg-white/20 transition-all duration-200"
                  >
                    Contact Us
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* TOC sidebar */}
          {headings.length > 0 && (
            <aside className="hidden lg:block">
              <nav className="sticky top-28 rounded-2xl border border-gray-200 bg-gray-50/60 p-6">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
                  <List className="h-3.5 w-3.5" />
                  On this page
                </p>
                <ul className="space-y-1.5">
                  {headings.map((h) => (
                    <li key={h.id}>
                      <a
                        href={`#${h.id}`}
                        className={`block text-[13px] leading-snug transition-colors hover:text-blue-600 ${
                          h.level === 3 ? 'pl-4 text-gray-400' : 'font-semibold text-gray-700'
                        } hover:text-blue-600`}
                      >
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>
          )}
        </div>
      </article>

      {/* Related articles */}
      {related.length > 0 && (
        <section className="bg-gray-50/60 border-t border-gray-100 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-8">
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold uppercase tracking-widest mb-3">
                  Keep reading
                </span>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Related Articles</h2>
              </div>
              <Link
                href="/blog"
                className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:gap-2.5 transition-all"
              >
                View all articles <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {related.map((r) => {
                const rVisual = getTagVisual(r.tag);
                const RIcon = rVisual.icon;
                return (
                  <Link
                    key={r.slug}
                    href={`/blog/${r.slug}`}
                    className="group flex flex-col sm:flex-row rounded-2xl border border-gray-200 bg-white overflow-hidden hover:shadow-xl hover:border-gray-300 transition-all duration-300"
                  >
                    <div className={`relative shrink-0 sm:w-40 h-32 sm:h-auto overflow-hidden ${rVisual.bg}`}>
                      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.18)_1px,transparent_1px)] bg-[size:12px_12px] opacity-60" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/40 backdrop-blur-md group-hover:scale-110 transition-transform duration-300">
                          <RIcon className="h-6 w-6 text-white" strokeWidth={1.75} />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col flex-1 p-5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-blue-600">{r.tag}</span>
                        <span className="flex items-center gap-1 text-[11px] text-gray-400">
                          <Clock className="h-3 w-3" />
                          {r.readTime}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors mb-1.5 line-clamp-2">
                        {r.title}
                      </h3>
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 flex-1">
                        {r.excerpt}
                      </p>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 mt-3 group-hover:gap-2 transition-all">
                        Read more <ArrowUpRight className="h-3 w-3" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
