const refusalPatterns: RegExp[] = [
  /(prompt\s*inject|ignore\s+previous\s+instructions|override\s+instructions)/i,
  /(exfiltrate|leak|steal|expose)\s+(data|information|credentials|secrets?)/i,
  /(passwords?|api\s*keys?|credit\s*card|social\s*security|ssn)/i,
  /(hate\s*speech|kill\s+\w+|violence\s+against|racial\s+slur|genocide)/i,
];

export function shouldRefuse(text: string): boolean {
  return refusalPatterns.some((pattern) => pattern.test(text));
}

export function refusalMessage(): string {
  return "I'm sorry, but I can't help with that request.";
}

// Example usage within a hypothetical /llm route handler:
// import type { Request, Response } from 'express';
// import { refusalMessage, shouldRefuse } from './lib/safety';
//
// async function handleLlmRoute(req: Request, res: Response) {
//   const userInput = req.body?.prompt ?? '';
//   if (shouldRefuse(userInput)) {
//     return res.status(200).json({ message: refusalMessage() });
//   }
//
//   // Continue with regular LLM processing when the input is acceptable.
// }
