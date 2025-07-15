interface StreamCardProps {
  stream: {
    _id: string;
    title: string;
    description?: string;
    hostName: string;
    participantCount: number;
    startedAt: number;
  };
  onJoin: () => void;
}

export function StreamCard({ stream, onJoin }: StreamCardProps) {
  const formatDuration = (startTime: number) => {
    const duration = Date.now() - startTime;
    const minutes = Math.floor(duration / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium text-red-600">LIVE</span>
        </div>
        <span className="text-sm text-gray-500">
          {formatDuration(stream.startedAt)}
        </span>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
        {stream.title}
      </h3>

      {stream.description && (
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
          {stream.description}
        </p>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">
          <span className="font-medium">Host:</span> {stream.hostName}
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <span>👥</span>
          <span>{stream.participantCount}</span>
        </div>
      </div>

      <button
        onClick={onJoin}
        className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md font-medium transition-colors"
      >
        Join Stream
      </button>
    </div>
  );
}
