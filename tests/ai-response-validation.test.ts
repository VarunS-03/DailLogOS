import assert from 'node:assert/strict';
import {
  parseAutoReflectionResponse,
  parseDailyBriefingResponse,
  parseDsaAssistanceResponse,
  parseNaturalLanguageLogResponse,
} from '../src/services/ai';
import { parseGeneratedSystemCandidate } from '../src/services/onboardingPipeline';
import { reportAiFailure } from '../src/services/aiDiagnostics';

assert.deepEqual(parseDailyBriefingResponse(JSON.stringify({
  headline: 'A steady day',
  focusMessage: 'Pick one next step.',
  threePriorities: ['Study', 'Move', 'Review'],
  motivationalQuote: 'Small steps count.',
})), {
  headline: 'A steady day',
  focusMessage: 'Pick one next step.',
  threePriorities: ['Study', 'Move', 'Review'],
  motivationalQuote: 'Small steps count.',
});
assert.throws(() => parseDailyBriefingResponse(JSON.stringify({
  headline: 'A day', focusMessage: 'Focus', threePriorities: ['1', '2'], motivationalQuote: 'Quote',
})));
assert.throws(() => parseDailyBriefingResponse(JSON.stringify({
  headline: 'A day', focusMessage: 'Focus', threePriorities: ['1', '2', '3'], motivationalQuote: 'Quote', code: 'ignored',
})));

assert.deepEqual(parseAutoReflectionResponse(JSON.stringify({ notes: 'A reflective note' })), { notes: 'A reflective note' });
assert.throws(() => parseAutoReflectionResponse(JSON.stringify({ notes: { html: '<script>' } })));
assert.throws(() => parseAutoReflectionResponse(JSON.stringify({ notes: 'x'.repeat(10_001) })));
assert.throws(() => parseAutoReflectionResponse(JSON.stringify({ notes: 'Valid', executable: 'payload' })));

assert.equal(parseDsaAssistanceResponse(JSON.stringify({
  patternDetected: 'Two pointers',
  recommendedApproach: 'Track both ends.',
  timeComplexityHint: 'O(n)',
  spaceComplexityHint: 'O(1)',
  keyObservation: 'The input is sorted.',
  pitfallToAvoid: 'Check equal values.',
})).patternDetected, 'Two pointers');
assert.throws(() => parseDsaAssistanceResponse('{}'));

const parsedDsaLog = parseNaturalLanguageLogResponse(JSON.stringify({
  type: 'dsa',
  summary: 'Logged a DSA problem.',
  data: { problem: 'Two Sum', platform: 'LeetCode', difficulty: 'Easy', pattern: 'Hash map' },
}), 'Two Sum');
assert.equal(parsedDsaLog.type, 'dsa');
if (parsedDsaLog.type === 'dsa') assert.equal(parsedDsaLog.data.problem, 'Two Sum');
assert.throws(() => parseNaturalLanguageLogResponse(JSON.stringify({
  type: 'dsa',
  summary: 'Logged a DSA problem.',
  data: { problem: 'Two Sum', platform: 'LeetCode', difficulty: 'Easy', pattern: 'Hash map', uid: 'attacker' },
}), 'Two Sum'));
const parsedNoteLog = parseNaturalLanguageLogResponse(JSON.stringify({
  type: 'reflection', summary: 'Saved a reflection.', data: { text: 'arbitrary' },
}), 'my original note');
assert.equal(parsedNoteLog.type, 'unknown');
if (parsedNoteLog.type === 'unknown') assert.equal(parsedNoteLog.data.text, 'my original note');

const generatedSystem = {
  briefingTagline: 'Steady progress',
  workoutCycle: 'Strength',
  schedule: [{ id: 's-1', time: '09:00-10:00', title: 'Focus', category: 'academic', status: 'pending' }],
  habits: [{ id: 'h-1', title: 'Walk', detail: 'After lunch', completed: false }],
  nonNegotiables: [{ id: 'n-1', name: 'Review', target: '10 minutes', completed: false }],
  workoutExercises: [{ name: 'Squat', target: '3 x 8', sets: 3 }],
};
assert.equal(parseGeneratedSystemCandidate(generatedSystem)?.schedule?.length, 1);
assert.equal(parseGeneratedSystemCandidate({ ...generatedSystem, executable: 'payload' }), null);
assert.equal(parseGeneratedSystemCandidate({
  ...generatedSystem,
  schedule: [{ id: 's-1', time: {}, title: 'Focus', category: 'academic', status: 'pending' }],
}), null);

const diagnosticOutput: string[] = [];
reportAiFailure('customization proposal', new Error('provider response contained a private key'), (message) => {
  diagnosticOutput.push(message);
});
assert.deepEqual(diagnosticOutput, ['AI customization proposal failed; safe fallback or error handling was used.']);
assert.equal(diagnosticOutput.some((line) => line.includes('private key')), false);

console.log('AI response validation tests passed.');
