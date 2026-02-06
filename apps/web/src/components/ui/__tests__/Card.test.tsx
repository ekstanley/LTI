/**
 * Tests for Card components
 * @module components/ui/__tests__/Card.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../Card';

describe('Card', () => {
  it('should render children', () => {
    render(
      <Card>
        <div data-testid="card-content">Card Content</div>
      </Card>
    );

    expect(screen.getByTestId('card-content')).toBeInTheDocument();
    expect(screen.getByText('Card Content')).toBeInTheDocument();
  });

  it('should apply base card className', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.querySelector('.card');

    expect(card).toBeInTheDocument();
  });

  it('should merge custom className with base className', () => {
    const { container } = render(<Card className="custom-class">Content</Card>);
    const card = container.querySelector('.card');

    expect(card).toHaveClass('card');
    expect(card).toHaveClass('custom-class');
  });
});

describe('CardHeader', () => {
  it('should render children', () => {
    render(
      <CardHeader>
        <div data-testid="header-content">Header Content</div>
      </CardHeader>
    );

    expect(screen.getByTestId('header-content')).toBeInTheDocument();
    expect(screen.getByText('Header Content')).toBeInTheDocument();
  });

  it('should apply border-b and padding classes', () => {
    const { container } = render(<CardHeader>Header</CardHeader>);
    const header = container.firstChild as HTMLElement;

    expect(header).toHaveClass('border-b');
    expect(header).toHaveClass('border-gray-200');
    expect(header).toHaveClass('px-6');
    expect(header).toHaveClass('py-4');
  });

  it('should merge custom className with base classes', () => {
    const { container } = render(<CardHeader className="custom-header">Header</CardHeader>);
    const header = container.firstChild as HTMLElement;

    expect(header).toHaveClass('border-b');
    expect(header).toHaveClass('custom-header');
  });
});

describe('CardTitle', () => {
  it('should render children', () => {
    render(<CardTitle>Card Title</CardTitle>);
    expect(screen.getByText('Card Title')).toBeInTheDocument();
  });

  it('should render as h3 element', () => {
    render(<CardTitle>Card Title</CardTitle>);
    const title = screen.getByText('Card Title');

    expect(title.tagName).toBe('H3');
  });

  it('should apply text styling classes', () => {
    render(<CardTitle>Card Title</CardTitle>);
    const title = screen.getByText('Card Title');

    expect(title).toHaveClass('text-lg');
    expect(title).toHaveClass('font-semibold');
    expect(title).toHaveClass('text-gray-900');
  });

  it('should merge custom className with base classes', () => {
    render(<CardTitle className="custom-title">Card Title</CardTitle>);
    const title = screen.getByText('Card Title');

    expect(title).toHaveClass('text-lg');
    expect(title).toHaveClass('custom-title');
  });
});

describe('CardContent', () => {
  it('should render children', () => {
    render(
      <CardContent>
        <p data-testid="content-text">Content Text</p>
      </CardContent>
    );

    expect(screen.getByTestId('content-text')).toBeInTheDocument();
    expect(screen.getByText('Content Text')).toBeInTheDocument();
  });

  it('should apply padding classes', () => {
    const { container } = render(<CardContent>Content</CardContent>);
    const content = container.firstChild as HTMLElement;

    expect(content).toHaveClass('px-6');
    expect(content).toHaveClass('py-4');
  });

  it('should merge custom className with base classes', () => {
    const { container } = render(<CardContent className="custom-content">Content</CardContent>);
    const content = container.firstChild as HTMLElement;

    expect(content).toHaveClass('px-6');
    expect(content).toHaveClass('custom-content');
  });
});

describe('CardFooter', () => {
  it('should render children', () => {
    render(
      <CardFooter>
        <button data-testid="footer-button">Action</button>
      </CardFooter>
    );

    expect(screen.getByTestId('footer-button')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });

  it('should apply border-t and padding classes', () => {
    const { container } = render(<CardFooter>Footer</CardFooter>);
    const footer = container.firstChild as HTMLElement;

    expect(footer).toHaveClass('border-t');
    expect(footer).toHaveClass('border-gray-200');
    expect(footer).toHaveClass('px-6');
    expect(footer).toHaveClass('py-4');
  });

  it('should merge custom className with base classes', () => {
    const { container } = render(<CardFooter className="custom-footer">Footer</CardFooter>);
    const footer = container.firstChild as HTMLElement;

    expect(footer).toHaveClass('border-t');
    expect(footer).toHaveClass('custom-footer');
  });
});

describe('Card composition', () => {
  it('should render full card with all sections', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Test Card</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Card body content</p>
        </CardContent>
        <CardFooter>
          <button>Action</button>
        </CardFooter>
      </Card>
    );

    expect(screen.getByText('Test Card')).toBeInTheDocument();
    expect(screen.getByText('Card body content')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });
});
