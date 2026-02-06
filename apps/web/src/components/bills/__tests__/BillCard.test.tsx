/**
 * Tests for BillCard component
 * @module components/bills/__tests__/BillCard.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BillCard } from '../BillCard';
import { createMockBill, createMockLegislator } from '@/__tests__/helpers/factories';

describe('BillCard', () => {
  it('should render bill title and ID', () => {
    const bill = createMockBill({
      id: 'hr-1-119',
      billType: 'hr',
      billNumber: 1,
      congressNumber: 119,
      title: 'Infrastructure Investment Act',
    });

    render(<BillCard bill={bill} />);

    expect(screen.getByText('HR 1 (119th)')).toBeInTheDocument();
    expect(screen.getByText('Infrastructure Investment Act')).toBeInTheDocument();
  });

  it('should render short title instead of full title when available', () => {
    const bill = createMockBill({
      title: 'A very long bill title that goes on and on and on',
      shortTitle: 'Short Bill Title',
    });

    render(<BillCard bill={bill} />);

    expect(screen.getByText('Short Bill Title')).toBeInTheDocument();
    expect(screen.queryByText('A very long bill title')).not.toBeInTheDocument();
  });

  it('should render sponsor information', () => {
    const bill = createMockBill({
      sponsor: createMockLegislator({
        fullName: 'Jane Smith',
        party: 'D',
        state: 'CA',
      }),
    });

    render(<BillCard bill={bill} />);

    expect(screen.getByText(/Sponsored by/i)).toBeInTheDocument();
    expect(screen.getByText(/Jane Smith \(Democrat-CA\)/i)).toBeInTheDocument();
  });

  it('should render status badge with correct label', () => {
    const bill = createMockBill({
      status: 'in_committee',
    });

    render(<BillCard bill={bill} />);

    expect(screen.getByText('In Committee')).toBeInTheDocument();
  });

  it('should render latest action with relative time', () => {
    const bill = createMockBill({
      latestAction: {
        date: '2025-01-15',
        text: 'Referred to the Committee on Ways and Means',
      },
    });

    render(<BillCard bill={bill} />);

    expect(screen.getByText(/Latest:/i)).toBeInTheDocument();
    expect(screen.getByText(/Referred to the Committee on Ways and Means/i)).toBeInTheDocument();
  });

  it('should render cosponsor count with correct pluralization', () => {
    const billWithOne = createMockBill({ cosponsorsCount: 1 });
    const { rerender } = render(<BillCard bill={billWithOne} />);

    expect(screen.getByText('1 cosponsor')).toBeInTheDocument();

    const billWithMany = createMockBill({ cosponsorsCount: 25 });
    rerender(<BillCard bill={billWithMany} />);

    expect(screen.getByText('25 cosponsors')).toBeInTheDocument();

    const billWithZero = createMockBill({ cosponsorsCount: 0 });
    rerender(<BillCard bill={billWithZero} />);

    expect(screen.getByText('0 cosponsors')).toBeInTheDocument();
  });

  it('should render policy area badge when present', () => {
    const bill = createMockBill({
      policyArea: 'Healthcare',
    });

    render(<BillCard bill={bill} />);

    expect(screen.getByText('Healthcare')).toBeInTheDocument();
  });

  it('should render introduced date', () => {
    const bill = createMockBill({
      introducedDate: '2025-01-15',
    });

    render(<BillCard bill={bill} />);

    // Look for the introduced date text specifically (not the status badge)
    expect(screen.getByText(/Introduced Jan/i)).toBeInTheDocument();
  });

  it('should render view button with correct link', () => {
    const bill = createMockBill({
      billType: 'hr',
      billNumber: 42,
      congressNumber: 119,
    });

    render(<BillCard bill={bill} />);

    const link = screen.getByRole('link', { name: /View/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/bills/hr-42-119');
  });

  it('should apply correct badge variant for became_law status', () => {
    const bill = createMockBill({
      status: 'became_law',
    });

    render(<BillCard bill={bill} />);

    const badge = screen.getByText('Became Law');
    expect(badge).toBeInTheDocument();
  });

  it('should apply correct badge variant for vetoed status', () => {
    const bill = createMockBill({
      status: 'vetoed',
    });

    render(<BillCard bill={bill} />);

    const badge = screen.getByText('Vetoed');
    expect(badge).toBeInTheDocument();
  });

  it('should apply correct badge variant for failed status', () => {
    const bill = createMockBill({
      status: 'failed',
    });

    render(<BillCard bill={bill} />);

    const badge = screen.getByText('Failed');
    expect(badge).toBeInTheDocument();
  });

  it('should render without sponsor if sponsor is null', () => {
    const bill = createMockBill({});
    delete bill.sponsor;

    render(<BillCard bill={bill} />);

    expect(screen.queryByText(/Sponsored by/i)).not.toBeInTheDocument();
  });

  it('should render without policy area if policy area is null', () => {
    const bill = createMockBill({});
    delete bill.policyArea;

    render(<BillCard bill={bill} />);

    // Only cosponsor count and introduced date should be present
    expect(screen.getByText(/cosponsor/i)).toBeInTheDocument();
    expect(screen.getByText(/Introduced Jan/i)).toBeInTheDocument();
  });
});
