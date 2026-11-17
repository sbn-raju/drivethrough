import { useEffect, useState } from 'react';
import { Chip } from '@heroui/react';
import { Clock, Route, TriangleAlert } from 'lucide-react';
import { get } from '../../lib/api';
import { formatDistance, formatDuration, type RouteEstimate } from './types';

/** Server-calculated route estimate with an Uber static map (Feature 05). Distances and times are estimates. */
export function RouteSummary({ estimate }: { estimate: RouteEstimate }) {
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    get<{ url: string | null }>(`/routes/estimates/${estimate.id}/static-map?w=960&h=360`)
      .then((r) => !cancelled && (r.url ? setMapUrl(r.url) : setMapFailed(true)))
      .catch(() => !cancelled && setMapFailed(true));
    return () => {
      cancelled = true;
    };
  }, [estimate.id]);

  const { coverage } = estimate;

  return (
    <section className="overflow-hidden rounded-[14px] border border-border bg-white" aria-label="Route estimate">
      <div className="aspect-[8/3] w-full bg-surface-secondary">
        {mapUrl ? (
          <img src={mapUrl} alt={`Map from ${estimate.pickup.formattedAddress} to ${estimate.drop.formattedAddress}`} className="size-full object-cover" referrerPolicy="no-referrer" onError={() => setMapFailed(true)} />
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-muted">{mapFailed ? 'Map preview unavailable' : 'Loading map…'}</div>
        )}
      </div>
      <div className="flex flex-col gap-4 p-5">
        <ol className="flex flex-col gap-3 text-sm">
          <li className="flex gap-3">
            <span className="mt-1 size-2.5 shrink-0 rounded-full bg-brand-black" aria-hidden />
            <span><span className="font-semibold">Pickup</span> · {estimate.pickup.formattedAddress}</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-1 size-2.5 shrink-0 rounded-sm bg-brand-yellow ring-1 ring-brand-black" aria-hidden />
            <span><span className="font-semibold">Drop</span> · {estimate.drop.formattedAddress}</span>
          </li>
        </ol>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span className="flex items-center gap-2 tabular"><Route className="size-4" aria-hidden /> {formatDistance(estimate.distanceMeters)}</span>
          <span className="flex items-center gap-2 tabular"><Clock className="size-4" aria-hidden /> about {formatDuration(estimate.durationSeconds)} driving</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted">States on this trip</span>
          {estimate.routeStates.map((s) => (
            <Chip key={s.code} size="sm" color={s.enabled ? 'default' : 'warning'}>{s.name}{s.enabled ? '' : ' · not served'}</Chip>
          ))}
          {coverage.status === 'approximate' && <Chip size="sm" color="accent">Approximate</Chip>}
        </div>
        {coverage.status !== 'determined' && (
          <p className={`flex gap-2 text-xs ${coverage.status === 'uncertain' ? 'text-warning' : 'text-muted'}`}>
            {coverage.status === 'uncertain' ? <TriangleAlert className="size-4 shrink-0" aria-hidden /> : null}
            {coverage.note}
          </p>
        )}
        <p className="text-xs text-muted">Distance and time are estimates from current conditions and are not guaranteed.</p>
      </div>
    </section>
  );
}
