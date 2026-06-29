'use client';
import { type ReactNode } from 'react';
import { useInView } from '@/hooks/useInView';

interface AnimatedSectionProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
}

export function AnimatedSection({
  children,
  className = '',
  delay = 0,
  duration = 700,
  direction = 'up',
}: AnimatedSectionProps) {
  const { ref, inView } = useInView();

  const directionClass = {
    up: 'translate-y-8',
    down: '-translate-y-8',
    left: '-translate-x-10',
    right: 'translate-x-10',
    none: '',
  }[direction];

  return (
    <div
      ref={ref}
      className={`transition-all ease-out will-change-transform
        ${inView ? 'opacity-100 translate-y-0 translate-x-0' : `opacity-0 ${directionClass}`}
        ${className}
      `}
      style={{
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
