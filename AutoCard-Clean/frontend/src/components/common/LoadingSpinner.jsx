import { Loader2 } from "lucide-react";

/**
 * LoadingSpinner Component
 * 
 * Displays an animated loading spinner
 * 
 * @param {string} size - Size of spinner: 'sm' | 'md' | 'lg' (default: 'md')
 * @param {string} color - Tailwind color class (default: 'text-primary')
 * @param {boolean} center - Whether to center in container (default: true)
 */
export default function LoadingSpinner({ size = 'md', color = 'text-primary', center = true }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const spinner = (
    <Loader2 className={`${sizeClasses[size]} ${color} animate-spin`} />
  );

  if (center) {
    return (
      <div className="flex items-center justify-center p-8">
        {spinner}
      </div>
    );
  }

  return spinner;
}
