'use client';

import { useCallback, useEffect, useState } from 'react';
import StatCard from '@/components/StatCard';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { getNewsStats } from '@/lib/news-api';
import { getHealth } from '@/lib/health-api';
import { triggerPipeline } from '@/lib/pipeline-api';
import { ApiClientError } from '@/lib/api-client';
import { HealthStatus, NewsStats } from '@/lib/types';

export default function Dashboard() {
  const [stats, setStats] = useState<NewsStats | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<string | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, healthData] = await Promise.all([getNewsStats(), getHealth()]);
      setStats(statsData);
      setHealth(healthData);
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Failed to load dashboard data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRunPipeline = async () => {
    setPipelineRunning(true);
    setPipelineResult(null);
    setPipelineError(null);
    try {
      const result = await triggerPipeline();
      setPipelineResult(result.enqueued ? 'Pipeline job enqueued.' : 'Pipeline job already active — skipped.');
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Failed to trigger pipeline';
      setPipelineError(msg);
    } finally {
      setPipelineRunning(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading dashboard..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  const backendStatus = health?.status === 'ok' ? 'Online' : 'Offline';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">
            Backend: <span className={health?.status === 'ok' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{backendStatus}</span>
          </span>
          <button
            type="button"
            onClick={handleRunPipeline}
            disabled={pipelineRunning}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pipelineRunning ? 'Running...' : 'Run Pipeline'}
          </button>
        </div>
      </div>

      {pipelineResult && <div className="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-800">{pipelineResult}</div>}
      {pipelineError && <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800">{pipelineError}</div>}

      {stats && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total" value={stats.total} accent="bg-blue-500" />
          <StatCard label="RAW" value={stats.raw} accent="bg-gray-500" />
          <StatCard label="PROCESSED" value={stats.processed} accent="bg-blue-400" />
          <StatCard label="TRANSLATED" value={stats.translated} accent="bg-cyan-500" />
          <StatCard label="QUEUED" value={stats.queued} accent="bg-yellow-500" />
          <StatCard label="APPROVED" value={stats.approved} accent="bg-indigo-500" />
          <StatCard label="PUBLISHED" value={stats.published} accent="bg-green-500" />
          <StatCard label="REJECTED" value={stats.rejected} accent="bg-red-500" />
        </div>
      )}
    </div>
  );
}