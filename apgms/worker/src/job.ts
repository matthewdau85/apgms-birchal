export interface Job {
  id: string;
  priority: number;
}

export function groupJobsByPriority(jobs: Job[]): Map<number, Job[]> {
  return jobs.reduce((bucket, job) => {
    const existing = bucket.get(job.priority) ?? [];
    existing.push(job);
    bucket.set(job.priority, existing);
    return bucket;
  }, new Map<number, Job[]>());
}
