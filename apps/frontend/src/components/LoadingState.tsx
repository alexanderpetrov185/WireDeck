export default function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-gray-500">{label}</div>
    </div>
  );
}