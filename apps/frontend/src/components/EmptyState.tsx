interface EmptyStateProps {
  message?: string;
}

export default function EmptyState({ message = 'No data available.' }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <p className="text-gray-500">{message}</p>
    </div>
  );
}