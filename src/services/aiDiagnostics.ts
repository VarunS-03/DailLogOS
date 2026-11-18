export type AiOperation =
  | 'briefing'
  | 'reflection'
  | 'DSA helper'
  | 'onboarding'
  | 'quick log parsing'
  | 'customization proposal'
  | 'customization save'
  | 'coach chat'
  | 'onboarding save';

type SafeLogger = (message: string) => void;

/** Avoid logging provider errors, response bodies, prompts, or credential-bearing request details. */
export function reportAiFailure(
  operation: AiOperation,
  _error: unknown,
  logger: SafeLogger = (message) => console.warn(message),
): void {
  logger(`AI ${operation} failed; safe fallback or error handling was used.`);
}
