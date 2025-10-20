const BAD_WORDS = /(ignore previous|reveal your system prompt|dump .*account|passwords?|bsb|ssn|credit card)/i;

export function shouldRefuse(input: string): boolean {
  return BAD_WORDS.test(input || "");
}

export function refusalMessage(): string {
  return "I can’t help with that request.";
}

// Example usage (commented):
// fastify.post("/llm", async (req, reply) => {
//   const { prompt } = req.body as { prompt: string };
//   if (shouldRefuse(prompt)) return reply.send({ text: refusalMessage() });
//   // else call your LLM…
// });
