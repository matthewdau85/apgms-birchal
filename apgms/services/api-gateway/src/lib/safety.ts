const refusalPatterns: RegExp[] = [
  /prompt\s+injection/i,
  /ignore\s+previous\s+instructions/i,
  /drop\s+table/i,
  /select\s+\*\s+from/i,
  /password\s*=/i,
  /api\s*key/i,
  /secret\s*key/i,
  /kill\s+(yourself|urself)/i,
  /hate\s+speech/i,
];

export function shouldRefuse(text: string): boolean {
  if (!text) {
    return false;
  }

  return refusalPatterns.some((pattern) => pattern.test(text));
}

export function refusalMessage(): string {
  return "I'm sorry, but I can't help with that request.";
}

// Example usage within a hypothetical /llm route handler:
// import type { Request, Response } from 'express';
//
// export async function handleLlmRequest(req: Request, res: Response) {
//   const userInput = req.body?.prompt ?? '';
//
//   if (shouldRefuse(userInput)) {
//     return res.status(200).json({ message: refusalMessage() });
//   }
//
//   // ... proceed with normal LLM handling logic.
// }
