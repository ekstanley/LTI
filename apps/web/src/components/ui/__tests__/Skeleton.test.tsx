/**
 * Tests for Skeleton components
 * @module components/ui/__tests__/Skeleton.test
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton, SkeletonCard, SkeletonList } from '../Skeleton';

describe('Skeleton', () => {
  it('should render skeleton element', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.querySelector('.skeleton');

    expect(skeleton).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<Skeleton className="h-4 w-full" />);
    const skeleton = container.querySelector('.skeleton');

    expect(skeleton).toHaveClass('skeleton');
    expect(skeleton).toHaveClass('h-4');
    expect(skeleton).toHaveClass('w-full');
  });

  it('should merge custom className with base skeleton class', () => {
    const { container } = render(<Skeleton className="custom-skeleton" />);
    const skeleton = container.querySelector('.skeleton');

    expect(skeleton).toHaveClass('skeleton');
    expect(skeleton).toHaveClass('custom-skeleton');
  });
});

describe('SkeletonCard', () => {
  it('should render card skeleton with multiple skeleton elements', () => {
    const { container } = render(<SkeletonCard />);
    const skeletons = container.querySelectorAll('.skeleton');

    // Should have at least 3 skeleton elements (title, subtitle, content)
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  it('should apply card styling', () => {
    const { container } = render(<SkeletonCard />);
    const card = container.querySelector('.card');

    expect(card).toBeInTheDocument();
  });

  it('should render skeleton elements with correct sizes', () => {
    const { container } = render(<SkeletonCard />);

    // Check for title skeleton (3/4 width)
    const titleSkeleton = container.querySelector('.h-4.w-3\\/4');
    expect(titleSkeleton).toBeInTheDocument();

    // Check for subtitle skeleton (1/2 width)
    const subtitleSkeleton = container.querySelector('.h-4.w-1\\/2');
    expect(subtitleSkeleton).toBeInTheDocument();

    // Check for content skeleton (full width, taller)
    const contentSkeleton = container.querySelector('.h-20.w-full');
    expect(contentSkeleton).toBeInTheDocument();
  });

  it('should render badge skeletons', () => {
    const { container } = render(<SkeletonCard />);

    // Should have badge-like skeletons (h-6 w-16 rounded-full)
    const badgeSkeletons = container.querySelectorAll('.h-6.w-16.rounded-full');
    expect(badgeSkeletons.length).toBe(2);
  });
});

describe('SkeletonList', () => {
  it('should render default count of 5 skeleton cards', () => {
    const { container } = render(<SkeletonList />);
    const cards = container.querySelectorAll('.card');

    expect(cards.length).toBe(5);
  });

  it('should render custom count of skeleton cards', () => {
    const { container } = render(<SkeletonList count={3} />);
    const cards = container.querySelectorAll('.card');

    expect(cards.length).toBe(3);
  });

  it('should render 10 skeleton cards when count is 10', () => {
    const { container } = render(<SkeletonList count={10} />);
    const cards = container.querySelectorAll('.card');

    expect(cards.length).toBe(10);
  });

  it('should apply space-y-4 gap between cards', () => {
    const { container } = render(<SkeletonList />);
    const listContainer = container.firstChild as HTMLElement;

    expect(listContainer).toHaveClass('space-y-4');
  });

  it('should render each skeleton card independently', () => {
    const { container } = render(<SkeletonList count={2} />);
    const cards = container.querySelectorAll('.card');

    // Each card should have its own skeleton elements
    cards.forEach((card) => {
      const skeletons = card.querySelectorAll('.skeleton');
      expect(skeletons.length).toBeGreaterThanOrEqual(3);
    });
  });
});
