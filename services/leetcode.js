import fetch from 'node-fetch';

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';

/**
 * Fetches recent accepted submissions for a given LeetCode username.
 * Returns an array of problem titleSlugs (lowercase).
 */
export async function fetchLeetcodeSolvedSlugs(username) {
  if (!username) return [];

  const query = `
    query recentAcSubmissions($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        id
        title
        titleSlug
        timestamp
      }
    }
  `;

  try {
    const response = await fetch(LEETCODE_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': `https://leetcode.com/u/${username}/`
      },
      body: JSON.stringify({
        query,
        variables: {
          username: username.trim(),
          limit: 100
        }
      })
    });

    if (!response.ok) {
      throw new Error(`LeetCode API returned HTTP ${response.status}`);
    }

    const json = await response.json();

    if (json.errors && json.errors.length > 0) {
      console.warn('[LeetCode Service] GraphQL errors:', json.errors[0].message);
    }

    const submissions = json.data?.recentAcSubmissionList || [];
    const slugs = [...new Set(submissions.map(sub => sub.titleSlug.toLowerCase()))];
    
    console.log(`[LeetCode Service] Found ${slugs.length} recent AC problem slugs for ${username}`);
    return slugs;
  } catch (error) {
    console.error(`[LeetCode Service] Failed to fetch solved problems for ${username}:`, error.message);
    return [];
  }
}

/**
 * Fetches ALL accepted submissions for a user using their LEETCODE_SESSION cookie.
 * This hits the private algorithms API.
 * Returns an array of problem titleSlugs (lowercase).
 */
export async function fetchFullLeetcodeSolvedSlugs(sessionCookie) {
  if (!sessionCookie) return [];

  const LEETCODE_ALGORITHMS_API = 'https://leetcode.com/api/problems/algorithms/';
  
  try {
    const response = await fetch(LEETCODE_ALGORITHMS_API, {
      method: 'GET',
      headers: {
        'Cookie': `LEETCODE_SESSION=${sessionCookie.trim()};`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://leetcode.com/problemset/all/'
      }
    });

    if (!response.ok) {
      throw new Error(`LeetCode API returned HTTP ${response.status}`);
    }

    const json = await response.json();
    if (!json.stat_status_pairs) {
      throw new Error('Invalid response format from LeetCode. Session cookie might be invalid or expired.');
    }

    // Filter out only accepted ("ac") problems
    const solvedSlugs = json.stat_status_pairs
      .filter(pair => pair.status === 'ac')
      .map(pair => pair.stat.question__title_slug.toLowerCase());

    console.log(`[LeetCode Service] Deep Sync found ${solvedSlugs.length} total AC problem slugs.`);
    return solvedSlugs;
  } catch (error) {
    console.error(`[LeetCode Service] Failed deep sync:`, error.message);
    throw new Error('Failed to deeply sync problems. Make sure your LEETCODE_SESSION cookie is valid.');
  }
}
