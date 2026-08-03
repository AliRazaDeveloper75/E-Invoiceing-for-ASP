'use client';

import Link from 'next/link';
import { Calendar, Clock, ArrowUpRight } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { AnimatedSection } from '@/app/(landing)/AnimatedSection';
import { POSTS } from '@/data/blog';
import { TAG_VISUALS } from '@/data/blog-visuals';

const POSTS_TO_SHOW = POSTS;

export default function BlogPage() {
  const { t } = useI18n();

  return (
    <div dir="ltr" className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0a1628] via-[#0f1f3d] to-[#1e3a5f] py-24">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 right-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:24px_24px] opacity-60" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-blue-200 text-xs font-semibold tracking-wide mb-6 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            {t('nav.blog')}
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-5 tracking-tight">
            E-Invoicing Insights & Updates
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-blue-200/70">
            Stay informed with the latest on UAE e-invoicing regulations, compliance tips, and platform updates.
          </p>
        </div>
      </section>

      {/* Section header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold uppercase tracking-widest mb-3">
              Latest Articles
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
              Fresh from the blog
            </h2>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-gray-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {POSTS_TO_SHOW.length} articles
          </div>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {POSTS_TO_SHOW.map((post) => {
            const visual = TAG_VISUALS[post.tag] ?? TAG_VISUALS.Business;

            return (
              <AnimatedSection key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col rounded-3xl bg-white ring-1 ring-gray-200/70 shadow-sm hover:shadow-2xl hover:shadow-blue-900/10 hover:-translate-y-1.5 transition-all duration-300 overflow-hidden h-full"
                >
                  {/* Upper section: image / icon */}
                  <div className={`relative h-44 overflow-hidden ${visual.bg}`}>
                    <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.18)_1px,transparent_1px)] bg-[size:14px_14px] opacity-70" />
                    <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/20 blur-2xl group-hover:scale-150 transition-transform duration-700" />
                    <div className="absolute -bottom-16 -left-10 w-44 h-44 rounded-full bg-black/10 blur-2xl group-hover:scale-150 transition-transform duration-700" />

                    <span className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-[11px] font-semibold tracking-wide ring-1 ring-white/25">
                      {post.tag}
                    </span>

                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/40 backdrop-blur-md shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                        <visual.icon className="h-8 w-8 text-white" strokeWidth={1.75} />
                      </div>
                    </div>

                    <span className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold text-gray-700 shadow-sm">
                      <Calendar className="h-3 w-3 text-blue-600" />
                      {post.date}
                    </span>
                  </div>

                  {/* Lower section: content */}
                  <div className="flex flex-col flex-1 p-6">
                    <h3 className="text-lg font-bold tracking-tight text-gray-900 group-hover:text-blue-700 transition-colors line-clamp-2 mb-2.5">
                      {post.title}
                    </h3>
                    <p className="text-sm text-gray-500 leading-relaxed line-clamp-3 mb-6">
                      {post.excerpt}
                    </p>
                    <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-4">
                      <span className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Clock className="h-3.5 w-3.5" />
                        {post.readTime}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-700 transition-colors duration-300 group-hover:bg-blue-600 group-hover:text-white">
                        Read more
                        <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              </AnimatedSection>
            );
          })}
        </div>
      </section>
    </div>
  );
}
