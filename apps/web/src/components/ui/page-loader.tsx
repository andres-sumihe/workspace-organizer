import { cn } from '@/lib/utils';

interface PageLoaderProps {
  /** Optional message to display below the loader */
  message?: string;
  /** Additional CSS classes for the container */
  className?: string;
}

/**
 * Centralized page loading component
 * Displays an animated progress bar centered horizontally and vertically
 * 
 * Features:
 * - Smooth indeterminate animation (left to right loop)
 * - Absolutely positioned to fill parent container
 * - Optional loading message
 * - Accessible with proper ARIA attributes
 */
export function PageLoader({ message = 'Loading...', className }: PageLoaderProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center gap-4 p-8',
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-xs">
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div 
            className="h-full w-1/3 rounded-full bg-primary animate-indeterminate"
          />
        </div>
      </div>
      {message && (
        <p className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
      <span className="sr-only">Loading content, please wait</span>
    </div>
  );
}

/**
 * Smaller inline loader for sections within a page
 */
export function SectionLoader({ message, className }: PageLoaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-8',
        className
      )}
      role="status"
      aria-busy="true"
    >
      <div className="w-48">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div 
            className="h-full w-1/3 rounded-full bg-primary animate-indeterminate"
          />
        </div>
      </div>
      {message && (
        <p className="text-xs text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
