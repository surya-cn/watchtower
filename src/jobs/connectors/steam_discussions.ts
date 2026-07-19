/*
 * ==============================================================================
 * FRAGILITY WARNING: HTML SCRAPING
 * ==============================================================================
 * This connector relies on cheerio to scrape raw HTML from Steam Discussions.
 * It is highly dependent on Steam's current CSS classes (.forum_topic, 
 * .forum_topic_name, etc.) staying completely stable. Steam has NO obligation 
 * to maintain these class names or DOM structure.
 * 
 * If ingestion for Steam sources silently stops returning results in the future 
 * (e.g. 0 posts fetched constantly), a markup change on Steam's end should be 
 * the FIRST thing investigated. This is a known fragility of HTML scraping.
 * ==============================================================================
 */

import * as cheerio from "cheerio";
import { RawPostInput } from "./types";

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function fetchSteamDiscussions(
  url: string,
  since: Date | null
): Promise<RawPostInput[]> {
  const allPosts: RawPostInput[] = [];
  const sinceTime = since ? since.getTime() : 0;

  // Add a reasonable delay to avoid hammering the server if fetching multiple
  await delay(1500);

  const res = await fetch(url, {
    headers: {
      "User-Agent": "WatchTower/1.0",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Steam Discussions page at ${url}: ${res.statusText}`);
  }

  const rawHtml = await res.text();
  const $ = cheerio.load(rawHtml);

  const topics = $('.forum_topic');
  
  if (topics.length === 0) {
    // If we didn't find any topics, but the page is huge, structure likely changed
    if (rawHtml.length > 50000) {
      console.warn(`[Steam Connector] WARNING: Found 0 threads but HTML is large (${rawHtml.length} bytes). Page structure may have changed, or selectors are stale.`);
    } else {
      console.log(`[Steam Connector] Found 0 threads (HTML size: ${rawHtml.length} bytes).`);
    }
    return [];
  }

  /*
   * PAGINATION NOTE:
   * This connector deliberately only scans the first (most recent) page of threads.
   * This is intentional because we run incrementally ("since last check"). If 
   * there are more than a full page of NEW threads since the last run, we will 
   * miss the overflow. For our typical run frequency, 1 page is sufficient.
   * 
   * ENHANCEMENT NOTE:
   * Currently, we only scrape the thread listing page (Title + Snippets). We do 
   * not click into individual threads to fetch full body content. This is an 
   * acceptable first-pass limitation, relying on titles and snippets for keyword 
   * clustering.
   */

  for (let i = 0; i < topics.length; i++) {
    const el = topics[i];
    const $el = $(el);
    
    // Title
    const title = $el.find('.forum_topic_name').text().replace(/\s+/g, ' ').trim();
    if (!title) continue;
    
    // URL
    let threadUrl = $el.find('a.forum_topic_overlay').attr('href');
    if (!threadUrl) continue;
    
    // Date
    const lastPostEl = $el.find('.forum_topic_lastpost');
    const timestamp = lastPostEl.attr('data-timestamp'); // Unix seconds
    
    let postedAt = new Date();
    if (timestamp) {
      postedAt = new Date(parseInt(timestamp, 10) * 1000);
    }

    // EARLY EXIT LOGIC:
    // Steam discussions are sorted by most recent activity.
    // If we hit a thread older than our `since` bound, we can stop processing.
    if (postedAt.getTime() <= sinceTime) {
      break;
    }

    // Snippets / Additional content
    // Some threads have a reply count that can be useful context.
    const replyCountText = $el.find('.forum_topic_reply_count').text().replace(/\s+/g, ' ').trim();
    
    let content = title;
    if (replyCountText) {
      content += `\n\nReplies: ${replyCountText}`;
    }

    // Author (sometimes visible in .forum_topic_op)
    const author = $el.find('.forum_topic_op').text().replace(/\s+/g, ' ').trim() || "Unknown";

    // Pinned threads often stay at the top and might not be updated recently,
    // but the `sinceTime` check handles skipping them if they are old.
    
    // Extract a cleaner ID from the URL if possible
    let sourcePostId = threadUrl;
    const match = threadUrl.match(/\/discussions\/\d+\/(\d+)/);
    if (match && match[1]) {
      sourcePostId = match[1];
    }

    allPosts.push({
      source_post_id: sourcePostId,
      author,
      content,
      url: threadUrl,
      posted_at: postedAt
    });
  }

  return allPosts;
}
