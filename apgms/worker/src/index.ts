export const buildJobId = (queue: string, id: number): string => {
  if (!queue) {
    throw new Error("queue must be provided");
  }
  if (!Number.isInteger(id) || id < 0) {
    throw new Error("id must be a non-negative integer");
  }
  return `${queue}::${id}`;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  // eslint-disable-next-line no-console
  console.log("worker ready");
}
