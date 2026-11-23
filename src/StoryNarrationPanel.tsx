'use client';
import { useEffect, useState } from 'react';
import { useAdminIdentity } from './useAdminIdentity';
import { narrationAdminRequest, narrationReasonLabel, narrationStateLabel, type NarrationAdminStatus } from './narrationAdminClient';

export default function StoryNarrationPanel({ storyId, revision, contentVersion, dirty = false }: { storyId: string; revision?: number; contentVersion?: string | null; dirty?: boolean }) {
  const [status, setStatus] = useState<NarrationAdminStatus | null>(null); const [error, setError] = useState('');
  const identity = useAdminIdentity(() => setStatus(null));
  const allowed = !!identity.session?.admin && !identity.denied;
  useEffect(() => {
    if (!allowed) return; const operation = identity.capture(); if (!operation) return;
    let active = true;
    void narrationAdminRequest<NarrationAdminStatus>(operation.parentId).then(value => { if (active && identity.isCurrent(operation)) { setStatus(value); setError(''); } }).catch(() => { if (active && identity.isCurrent(operation)) setError('De audiostatus is nu niet bereikbaar. Het verhaal blijft bewaard.'); });
    return () => { active = false; };
  }, [allowed, storyId, revision, contentVersion]);
  const jobs = status?.queue.filter(job => job.storyId === storyId) ?? [];
  return <section className="admin-card" aria-labelledby="story-narration-title"><h2 id="story-narration-title">Voorleesaudio</h2><p>Bij bevestigd bewaren of importeren wordt de redactionele tekst vastgelegd voor automatische generatie. Audio wordt pas vrijgegeven na transcript- en luistercontrole, voor precies de bijbehorende tekstversie.</p>{dirty && <p className="notice">Bewaar je tekstwijzigingen eerst. De onderstaande opdrachten horen bij reeds bevestigde serverversies.</p>}{error ? <p role="status">{error}</p> : !status ? <p role="status">Audiostatus ophalen…</p> : <><p>{status.keyConfigured ? 'OpenAI-sleutel ingesteld.' : 'Wacht op OpenAI-koppeling. Opdrachten blijven bewaard; verhalen bewerken en lezen blijft mogelijk.'}</p>{jobs.length ? <div className="narration-queue">{jobs.map(job => <a className="admin-dashboard-card" key={job.id} href={`/studio/voorlezen?jobId=${encodeURIComponent(job.id)}&storyId=${encodeURIComponent(storyId)}`}><strong>{narrationStateLabel(job.state)}</strong><p>{job.completedItems}/{job.expectedItems} onderdelen · {job.reviewItems} te controleren</p><small>{job.contentVersion}{job.reason ? ` · ${narrationReasonLabel(job.reason)}` : ''}</small><span>Pad, leesniveau en stem controleren →</span></a>)}</div> : <p>Er is nog geen audio-opdracht voor dit verhaal. Bewaar een geldig concept of neem de versie op in het catalogusplan.</p>}</>}<div className="account-actions"><a className="account-secondary" href={`/studio/voorlezen?storyId=${encodeURIComponent(storyId)}`}>Audiowachtrij, raming en catalogusdekking openen</a></div></section>;
}
