/**
 * EmptyState Component
 * 
 * Displays an empty state with icon, message, and optional action button
 * 
 * @param {React.Component} icon - Lucide icon component
 * @param {string} title - Heading text
 * @param {string} message - Description text
 * @param {React.Component} action - Optional action button/component
 */
export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      {Icon && (
        <div className="mb-4">
          <Icon className="h-16 w-16 text-muted-foreground/60" />
        </div>
      )}
      
      {title && (
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {title}
        </h3>
      )}
      
      {message && (
        <p className="text-muted-foreground mb-6 max-w-md">
          {message}
        </p>
      )}
      
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  );
}
