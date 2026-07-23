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
  let allPosts: RawPostInput[] = [];
  const sinceTime = since ? since.getTime() : 0;
  
  // Scrape up to 5 pages to catch history on fast-moving boards like CS2
  const MAX_PAGES = 5;

  for (let page = 1; page <= MAX_PAGES; page++) {
    // Steam discussion pagination URL format: url?p=2
    const pageUrl = url.includes('?') ? `${url}&p=${page}` : `${url}?p=${page}`;
    
    await delay(1500);

    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent": "WatchTower/1.0",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    if (!res.ok) {
      if (page === 1) {
        throw new Error(`Failed to fetch Steam Discussions page at ${pageUrl}: ${res.statusText}`);
      } else {
        break; // Stop if subsequent pages fail
      }
    }

    const rawHtml = await res.text();
    const $ = cheerio.load(rawHtml);

    const topics = $('.forum_topic');
    
    if (topics.length === 0) {
      if (page === 1) {
        if (rawHtml.length > 50000) {
          console.warn(`[Steam Connector] WARNING: Found 0 threads on page 1 but HTML is large. Page structure may have changed.`);
        }
      }
      break; // No more topics, stop paginating
    }

    let reachedOlderThanSince = false;

    for (let i = 0; i < topics.length; i++) {
      const el = topics[i];
      const $el = $(el);
      
      const title = $el.find('.forum_topic_name').text().replace(/\s+/g, ' ').trim();
      if (!title) continue;
      
      let threadUrl = $el.find('a.forum_topic_overlay').attr('href');
      if (!threadUrl) continue;
      
      const lastPostEl = $el.find('.forum_topic_lastpost');
      const timestamp = lastPostEl.attr('data-timestamp'); // Unix seconds
      
      let postedAt = new Date();
      if (timestamp) {
        postedAt = new Date(parseInt(timestamp, 10) * 1000);
      }

      if (postedAt.getTime() <= sinceTime) {
        reachedOlderThanSince = true;
        break; // Stop processing topics
      }

      const replyCountText = $el.find('.forum_topic_reply_count').text().replace(/\s+/g, ' ').trim();
      const replyCount = parseInt(replyCountText, 10) || 0;
      
      const author = $el.find('.forum_topic_op').text().replace(/\s+/g, ' ').trim() || "Unknown";
      
      let sourcePostId = threadUrl;
      const match = threadUrl.match(/\/discussions\/\d+\/(\d+)/);
      if (match && match[1]) {
        sourcePostId = match[1];
      }

      // Add original topic
      allPosts.push({
        source_post_id: sourcePostId,
        author,
        content: title,
        url: threadUrl,
        posted_at: postedAt // OP posted time might be different but we only have lastpost time from the index easily, this is close enough for OP sorting unless we fetch it. We will use lastpost for the whole thread.
      });

      // Fetch comments if there are replies
      if (replyCount > 0) {
        console.log(`  -> Fetching ${replyCount} replies for thread: ${title.substring(0, 30)}...`);
        await delay(1000);
        
        try {
          const threadRes = await fetch(threadUrl, {
            headers: {
              "User-Agent": "WatchTower/1.0",
              "Accept-Language": "en-US,en;q=0.9"
            }
          });
          if (threadRes.ok) {
            const threadHtml = await threadRes.text();
            const $$ = cheerio.load(threadHtml);
            
            $$('.commentthread_comment').each((j, c) => {
              const commentAuthor = $$(c).find('.commentthread_author_link').text().trim() || "Unknown Reply Author";
              const commentText = $$(c).find('.commentthread_comment_text').text().trim();
              const commentTimestampRaw = $$(c).find('.commentthread_comment_timestamp').attr('data-timestamp');
              
              if (!commentText) return;

              let commentPostedAt = postedAt;
              if (commentTimestampRaw) {
                commentPostedAt = new Date(parseInt(commentTimestampRaw, 10) * 1000);
              }

              // Create a unique post ID for the comment
              const commentId = $$(c).attr('id') || `comment_${j}`;
              const commentSourcePostId = `${sourcePostId}_${commentId}`;
              
              // We use only the comment text so it is strictly filtered by keywords
              const fullCommentText = commentText;

              allPosts.push({
                source_post_id: commentSourcePostId,
                author: commentAuthor,
                content: fullCommentText,
                url: threadUrl,
                posted_at: commentPostedAt
              });
            });
          }
        } catch (err: any) {
          console.warn(`[Steam Connector] Failed to fetch comments for thread ${threadUrl}: ${err.message}`);
        }
      }
    }

    if (reachedOlderThanSince) {
      break; // Stop fetching new pages
    }
  }

  return allPosts;
}
