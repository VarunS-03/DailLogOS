import {
  CustomTrackerDefinition,
  CustomTrackerValue,
  DashboardWidgetId,
  SystemModuleId,
  UserSystemConfiguration,
  UserSettings,
  OnboardingPillar,
  OnboardingRequirements,
} from '../types';
import { validateOnboardingRequirements } from './accountLifecycle';

export const CURRENT_SYSTEM_CONFIGURATION_VERSION = 1;

export const SYSTEM_MODULE_REGISTRY: Array<{
  id: SystemModuleId;
  label: string;
  description: string;
}> = [
  { id: 'academics', label: 'Academics', description: 'Study sessions and learning notes.' },
  { id: 'dsa', label: 'DSA Practice', description: 'Problem-solving logs and review.' },
  { id: 'workout', label: 'Workouts', description: 'Exercise sessions and performance.' },
  { id: 'projects', label: 'Projects', description: 'Project work and tangible outputs.' },
  { id: 'insights', label: 'Insights & Review', description: 'Reflection, trends, and history.' },
];

export const DASHBOARD_WIDGET_REGISTRY: Array<{
  id: DashboardWidgetId;
  label: string;
  description: string;
}> = [
  { id: 'briefing', label: 'Daily briefing', description: 'AI-powered morning summary.' },
  { id: 'commitments', label: 'Commitments & habits', description: 'Daily non-negotiables and habits.' },
  { id: 'schedule', label: 'Schedule', description: 'Editable daily timeline.' },
  { id: 'workspaces', label: 'Quick workspaces', description: 'Shortcuts to study and DSA.' },
  { id: 'goals', label: 'Goals', description: 'Your primary and supporting goals.' },
  { id: 'custom_trackers', label: 'Custom trackers', description: 'Daily numeric values for your trackers.' },
];

const SYSTEM_MODULE_IDS = SYSTEM_MODULE_REGISTRY.map((module) => module.id);
const DASHBOARD_WIDGET_IDS = DASHBOARD_WIDGET_REGISTRY.map((widget) => widget.id);
const TRACKER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export function createDefaultSystemConfiguration(): UserSystemConfiguration {
  return {
    schemaVersion: CURRENT_SYSTEM_CONFIGURATION_VERSION,
    enabledModules: [...SYSTEM_MODULE_IDS],
    dashboardLayout: [...DASHBOARD_WIDGET_IDS],
    customTrackers: [],
    goals: { primary: '', secondary: [] },
    aiBehavior: 'enabled',
  };
}

export function createSystemConfigurationFromRequirements(value: unknown): UserSystemConfiguration {
  const requirements = validateOnboardingRequirements(value);
  if (!requirements) throw new Error('Cannot create a system configuration from invalid onboarding requirements.');

  const moduleByPillar: Record<OnboardingPillar, SystemModuleId> = {
    academics: 'academics',
    dsa: 'dsa',
    fitness: 'workout',
    projects: 'projects',
    reading: 'academics',
  };
  const preferences = new Set(requirements.sourceAnswers.appPreferences);
  const enabledModules = Array.from(new Set(
    requirements.interpretation.priorityAreas.map((area) => moduleByPillar[area])
  ));
  if (preferences.has('weekly_review') && !enabledModules.includes('insights')) {
    enabledModules.push('insights');
  }
  if (enabledModules.length === 0) enabledModules.push('academics');

  const layoutByStyle: Record<OnboardingRequirements['sourceAnswers']['planningStyle'], DashboardWidgetId[]> = {
    minimal: ['schedule', 'commitments', 'goals', 'workspaces'],
    balanced: ['commitments', 'schedule', 'workspaces', 'goals'],
    structured: ['schedule', 'commitments', 'workspaces', 'goals'],
  };
  const dashboardLayout = [...layoutByStyle[requirements.sourceAnswers.planningStyle]];
  if (preferences.has('daily_briefing')) dashboardLayout.unshift('briefing');

  const configuration: UserSystemConfiguration = {
    schemaVersion: CURRENT_SYSTEM_CONFIGURATION_VERSION,
    enabledModules,
    dashboardLayout,
    customTrackers: [],
    goals: {
      primary: requirements.sourceAnswers.primaryGoal.trim(),
      secondary: requirements.sourceAnswers.secondaryGoals
        .split(/\r?\n/)
        .map((goal) => goal.trim().slice(0, 200))
        .filter(Boolean)
        .slice(0, 5),
    },
    aiBehavior: preferences.has('daily_briefing') || preferences.has('ai_suggestions')
      ? 'enabled'
      : 'disabled',
  };
  const validatedConfiguration = validateUserSystemConfiguration(configuration);
  if (!validatedConfiguration) throw new Error('The generated system configuration is invalid.');
  return validatedConfiguration;
}

function isUniqueList<T extends string>(
  value: unknown,
  supportedValues: T[],
  maxItems: number
): value is T[] {
  return Array.isArray(value)
    && value.length <= maxItems
    && value.every((item) => typeof item === 'string' && supportedValues.includes(item as T))
    && new Set(value).size === value.length;
}

function validateTracker(value: unknown): CustomTrackerDefinition | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const allowedKeys = ['id', 'name', 'unit', 'dailyTarget'];
  if (Object.keys(data).some((key) => !allowedKeys.includes(key))) return null;
  if (
    typeof data.id !== 'string'
    || !TRACKER_ID_PATTERN.test(data.id)
    || typeof data.name !== 'string'
    || data.name.trim().length === 0
    || data.name.length > 50
    || typeof data.unit !== 'string'
    || data.unit.length > 20
    || (data.dailyTarget !== undefined
      && (typeof data.dailyTarget !== 'number' || !Number.isFinite(data.dailyTarget) || data.dailyTarget < 0 || data.dailyTarget > 100000))
  ) {
    return null;
  }
  return {
    id: data.id,
    name: data.name.trim(),
    unit: data.unit.trim(),
    ...(typeof data.dailyTarget === 'number' ? { dailyTarget: data.dailyTarget } : {}),
  };
}

export function validateUserSystemConfiguration(value: unknown): UserSystemConfiguration | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const allowedKeys = ['schemaVersion', 'enabledModules', 'dashboardLayout', 'customTrackers', 'goals', 'aiBehavior'];
  if (Object.keys(data).some((key) => !allowedKeys.includes(key))) return null;

  const goals = data.goals;
  const aiBehavior = data.aiBehavior;
  if (!goals || typeof goals !== 'object' || Array.isArray(goals) || !aiBehavior || typeof aiBehavior !== 'string') return null;
  const goalData = goals as Record<string, unknown>;
  if (Object.keys(goalData).some((key) => key !== 'primary' && key !== 'secondary')) return null;

  const enabledModules = data.enabledModules;
  const dashboardLayout = data.dashboardLayout;
  const customTrackers = data.customTrackers;
  if (
    data.schemaVersion !== CURRENT_SYSTEM_CONFIGURATION_VERSION
    || !isUniqueList(enabledModules, SYSTEM_MODULE_IDS, SYSTEM_MODULE_IDS.length)
    || !isUniqueList(dashboardLayout, DASHBOARD_WIDGET_IDS, DASHBOARD_WIDGET_IDS.length)
    || !Array.isArray(customTrackers)
    || customTrackers.length > 10
    || typeof goalData.primary !== 'string'
    || goalData.primary.length > 500
    || !Array.isArray(goalData.secondary)
    || goalData.secondary.length > 5
    || !goalData.secondary.every((goal) => typeof goal === 'string' && goal.trim().length > 0 && goal.length <= 200)
    || (aiBehavior !== 'enabled' && aiBehavior !== 'disabled')
  ) {
    return null;
  }

  const validatedTrackers: CustomTrackerDefinition[] = [];
  for (const tracker of customTrackers) {
    const validatedTracker = validateTracker(tracker);
    if (!validatedTracker) return null;
    validatedTrackers.push(validatedTracker);
  }
  if (new Set(validatedTrackers.map((tracker) => tracker.id)).size !== validatedTrackers.length) return null;

  return {
    schemaVersion: CURRENT_SYSTEM_CONFIGURATION_VERSION,
    enabledModules: [...enabledModules],
    dashboardLayout: [...dashboardLayout],
    customTrackers: validatedTrackers,
    goals: {
      primary: goalData.primary.trim(),
      secondary: goalData.secondary.map((goal) => (goal as string).trim()),
    },
    aiBehavior,
  };
}

export function validateCustomTrackerValues(value: unknown): CustomTrackerValue[] | null {
  if (!Array.isArray(value) || value.length > 10) return null;
  const entries: CustomTrackerValue[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const data = entry as Record<string, unknown>;
    if (
      Object.keys(data).some((key) => key !== 'trackerId' && key !== 'value')
      || typeof data.trackerId !== 'string'
      || !TRACKER_ID_PATTERN.test(data.trackerId)
      || typeof data.value !== 'number'
      || !Number.isFinite(data.value)
      || data.value < 0
      || data.value > 100000
    ) {
      return null;
    }
    entries.push({ trackerId: data.trackerId, value: data.value });
  }
  return new Set(entries.map((entry) => entry.trackerId)).size === entries.length ? entries : null;
}

export function getSystemConfiguration(value: unknown): UserSystemConfiguration {
  if (value === undefined) return createDefaultSystemConfiguration();
  const configuration = validateUserSystemConfiguration(value);
  if (!configuration) throw new Error('The saved system configuration is invalid.');
  return configuration;
}

export function normalizeUserSettings(settings: UserSettings): UserSettings {
  return {
    ...settings,
    systemConfiguration: getSystemConfiguration(settings.systemConfiguration),
  };
}
