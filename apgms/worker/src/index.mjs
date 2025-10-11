setInterval(() => {
  console.log(`[worker] heartbeat ${new Date().toISOString()}`);
}, 5000);

console.log("Worker started");
