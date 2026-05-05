import { AlertCircle } from 'lucide-react';

interface PlaceholderProps {
  title?: string;
  description?: string;
}

export default function Placeholder({
  title = 'Page Under Development',
  description = 'This page is being developed. Check back soon!',
}: PlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
      <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
      <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
      <p className="text-muted-foreground max-w-md">{description}</p>
    </div>
  );
}
