import fetch from 'node-fetch';

let cachedRatings = [];
let slugToIdMap = new Map();
let idToProblemMap = new Map();
let lastFetchedAt = null;

const ZEROTRAC_URL = 'https://zerotrac.github.io/leetcode_problem_rating/data.json';
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function fetchZerotracData() {
  try {
    console.log('[Zerotrac Service] Fetching latest problem ratings...');
    const response = await fetch(ZEROTRAC_URL);
    if (!response.ok) {
      throw new Error(`Zerotrac fetch failed HTTP ${response.status}`);
    }
    const data = await response.json();
    
    cachedRatings = data.map(item => ({
      id: item.ID,
      title: item.Title,
      titleZh: item.TitleZH,
      titleSlug: item.TitleSlug,
      rating: Math.round(item.Rating),
      exactRating: item.Rating,
      contestSlug: item.ContestSlug,
      contestName: item.ContestID_en || item.ContestSlug,
      problemIndex: item.ProblemIndex
    }));

    slugToIdMap.clear();
    idToProblemMap.clear();

    cachedRatings.forEach(problem => {
      if (problem.titleSlug) {
        slugToIdMap.set(problem.titleSlug.toLowerCase(), problem.id);
      }
      if (problem.id) {
        idToProblemMap.set(problem.id, problem);
      }
    });

    lastFetchedAt = new Date();
    console.log(`[Zerotrac Service] Loaded ${cachedRatings.length} rated problems at ${lastFetchedAt.toISOString()}`);
    return cachedRatings;
  } catch (error) {
    console.error('[Zerotrac Service] Error fetching ratings:', error.message);
    if (cachedRatings.length === 0) {
      console.warn('[Zerotrac Service] No cached data available!');
    }
    return cachedRatings;
  }
}

export function getCachedRatings() {
  // Trigger async refresh if cache stale
  if (!lastFetchedAt || (Date.now() - lastFetchedAt.getTime() > CACHE_DURATION_MS)) {
    fetchZerotracData();
  }
  return cachedRatings;
}

export function getSlugToIdMap() {
  return slugToIdMap;
}

export function getIdToProblemMap() {
  return idToProblemMap;
}
