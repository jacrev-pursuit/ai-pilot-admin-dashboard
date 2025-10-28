export const fetchWeeklyNps = async (startDate, endDate, cohort) => {
  const params = new URLSearchParams({ startDate, endDate });
  if (cohort) params.set('cohort', cohort);
  const resp = await fetch(`/api/surveys/nps/weekly?${params.toString()}`);
  if (!resp.ok) throw new Error('Failed to fetch weekly NPS');
  return resp.json();
};

export const fetchCohortNps = async (startDate, endDate, cohort) => {
  const params = new URLSearchParams({ startDate, endDate });
  if (cohort) params.set('cohort', cohort);
  const resp = await fetch(`/api/surveys/nps/cohorts?${params.toString()}`);
  if (!resp.ok) throw new Error('Failed to fetch cohort NPS');
  return resp.json();
};

export const fetchSurveyResponses = async (startDate, endDate, cohort, week) => {
  const params = new URLSearchParams({ startDate, endDate });
  if (cohort) params.set('cohort', cohort);
  if (week) params.set('week', String(week));
  const resp = await fetch(`/api/surveys/responses?${params.toString()}`);
  if (!resp.ok) throw new Error('Failed to fetch survey responses');
  return resp.json();
};

export const fetchSurveyThemes = async (startDate, endDate, cohort, topN = 25) => {
  const params = new URLSearchParams({ startDate, endDate, topN: String(topN) });
  if (cohort) params.set('cohort', cohort);
  const resp = await fetch(`/api/surveys/themes?${params.toString()}`);
  if (!resp.ok) throw new Error('Failed to fetch survey themes');
  return resp.json();
};

export const fetchWeeklyNpsByCohort = async (startDate, endDate, cohort, mode = 'program') => {
  const params = new URLSearchParams({ startDate, endDate, mode });
  if (cohort) params.set('cohort', cohort);
  const resp = await fetch(`/api/surveys/nps/weekly-by-cohort?${params.toString()}`);
  if (!resp.ok) throw new Error('Failed to fetch weekly NPS by cohort');
  return resp.json();
};


