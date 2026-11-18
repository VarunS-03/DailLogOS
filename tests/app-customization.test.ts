import { createDefaultDayRecord } from '../src/constants/templates';
import { parseAppCustomizationResponse } from '../src/services/appCustomization';
import { createDefaultSystemConfiguration } from '../src/services/systemConfiguration';
import { UserSystemConfiguration } from '../src/types';

let passed = 0;

function assert(name: string, condition: boolean): void {
  if (!condition) throw new Error(`FAIL: ${name}`);
  passed++;
}

function expectInvalid(name: string, response: unknown, configuration: UserSystemConfiguration): void {
  let rejected = false;
  try {
    parseAppCustomizationResponse(JSON.stringify(response), createDefaultDayRecord('2026-09-11'), configuration);
  } catch {
    rejected = true;
  }
  assert(name, rejected);
}

const day = createDefaultDayRecord('2026-09-11');
day.schedule = [{
  id: 'schedule-1',
  time: '09:00',
  title: 'Project work',
  category: 'project',
  status: 'completed',
  note: 'Keep this completed entry',
}];
day.habits = [{
  id: 'habit-1',
  title: 'Walk',
  detail: 'Outside',
  completed: true,
}];
day.workout.dailyNonNegotiables = [{
  id: 'commitment-1',
  name: 'Stretch',
  target: '10 minutes',
  completed: true,
}];
day.workout.exercises = [{
  id: 'exercise-1',
  name: 'Squat',
  target: '8 reps',
  completed: true,
  skipped: false,
  sets: 3,
  reps: '8',
  weight: '40 kg',
  duration: '',
  notes: 'Existing set notes',
}];

const currentConfiguration: UserSystemConfiguration = {
  ...createDefaultSystemConfiguration(),
  enabledModules: ['academics', 'dsa', 'workout', 'projects', 'insights'],
  dashboardLayout: ['briefing', 'commitments', 'schedule', 'workspaces', 'goals', 'custom_trackers'],
  customTrackers: [{ id: 'water', name: 'Water', unit: 'ml', dailyTarget: 2000 }],
  goals: { primary: 'Finish project', secondary: ['Read daily'] },
  aiBehavior: 'disabled',
};

const proposal = parseAppCustomizationResponse(JSON.stringify({
  summary: 'Hide DSA and prioritize the schedule.',
  dailySystem: {
    workoutMode: 'gym',
    workoutCycle: 'Strength',
    schedule: [{ time: '09:00', title: 'Project work', category: 'project' }],
    habits: [{ title: 'Walk', detail: 'Outside' }],
    nonNegotiables: [{ name: 'Stretch', target: '10 minutes' }],
    workoutExercises: [{ name: 'Squat', target: '8 reps', sets: 3 }],
  },
  systemConfiguration: {
    enabledModules: ['academics', 'workout', 'projects'],
    dashboardLayout: ['schedule', 'commitments', 'workspaces', 'goals', 'custom_trackers'],
  },
}), day, currentConfiguration);

assert('configuration proposals can change supported module and dashboard selections',
  proposal.systemConfiguration.enabledModules.join(',') === 'academics,workout,projects'
    && proposal.systemConfiguration.dashboardLayout[0] === 'schedule');
assert('configuration proposals preserve custom trackers, goals, and AI preferences',
  proposal.systemConfiguration.customTrackers[0].id === 'water'
    && proposal.systemConfiguration.goals.primary === 'Finish project'
    && proposal.systemConfiguration.aiBehavior === 'disabled');
assert('routine normalization preserves completion state and existing IDs',
  proposal.dailySystem.schedule[0].id === 'schedule-1'
    && proposal.dailySystem.habits[0].id === 'habit-1'
    && proposal.dailySystem.nonNegotiables[0].id === 'commitment-1'
    && proposal.dailySystem.schedule[0].status === 'completed'
    && proposal.dailySystem.habits[0].completed
    && proposal.dailySystem.nonNegotiables[0].completed);

const unchangedConfigurationProposal = parseAppCustomizationResponse(JSON.stringify({
  summary: 'Keep the current application setup.',
  dailySystem: {
    workoutMode: 'gym',
    workoutCycle: 'Strength',
    schedule: [{ time: '09:00', title: 'Project work', category: 'project' }],
    habits: [{ title: 'Walk', detail: 'Outside' }],
    nonNegotiables: [{ name: 'Stretch', target: '10 minutes' }],
    workoutExercises: [{ name: 'Squat', target: '8 reps', sets: 3 }],
  },
}), day, currentConfiguration);
assert('responses without configuration changes retain the current configuration',
  unchangedConfigurationProposal.systemConfiguration.customTrackers.length === 1
    && unchangedConfigurationProposal.systemConfiguration.enabledModules.length === currentConfiguration.enabledModules.length);

expectInvalid('unsupported configuration fields are rejected', {
  summary: 'Change trackers.',
  dailySystem: {
    workoutMode: 'gym',
    workoutCycle: 'Strength',
    schedule: [],
    habits: [],
    nonNegotiables: [],
    workoutExercises: [],
  },
  systemConfiguration: { customTrackers: [] },
}, currentConfiguration);

expectInvalid('unsupported modules are rejected', {
  summary: 'Enable an unsupported module.',
  dailySystem: {
    workoutMode: 'gym',
    workoutCycle: 'Strength',
    schedule: [],
    habits: [],
    nonNegotiables: [],
    workoutExercises: [],
  },
  systemConfiguration: { enabledModules: ['unknown'], dashboardLayout: [] },
}, currentConfiguration);

console.log(`App customization tests: ${passed} passed.`);
