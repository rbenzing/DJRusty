import { Router } from 'express';
import type { Request, Response } from 'express';

export const videosRouter = Router();

/**
 * GET /api/videos
 * Proxy to YouTube Data API v3 — lists the authenticated user's channel videos.
 * Requires the Authorization header to be forwarded from the frontend.
 *
 * Query params:
 *   channelId    (optional) — if omitted, uses the authenticated user's default channel
 *   pageToken    (optional) — pagination cursor
 *   maxResults   (optional, default 50)
 */
videosRouter.get('/', async (req: Request, res: Response) => {
  const apiKey = process.env['YOUTUBE_API_KEY'];
  if (!apiKey) {
    res.status(501).json({ error: 'YOUTUBE_API_KEY not configured' });
    return;
  }

  const { channelId, pageToken, maxResults = '50' } = req.query as Record<string, string>;

  try {
    // Step 1: resolve channel's uploads playlist
    const chanUrl = new URL('https://www.googleapis.com/youtube/v3/channels');
    chanUrl.searchParams.set('part', 'contentDetails');
    chanUrl.searchParams.set('key', apiKey);
    if (channelId) {
      chanUrl.searchParams.set('id', channelId);
    } else {
      chanUrl.searchParams.set('mine', 'true');
      // Forward auth header for OAuth2 "mine" queries
      const authHeader = req.headers['authorization'];
      if (authHeader) {
        const chanResp = await fetch(chanUrl.toString(), {
          headers: { Authorization: authHeader },
        });
        const chanData = await chanResp.json() as { items?: Array<{ contentDetails: { relatedPlaylists: { uploads: string } } }> };
        const uploadsId = chanData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
        if (!uploadsId) { res.status(404).json({ error: 'No uploads playlist found' }); return; }
        return res.json(await fetchPlaylistItems(uploadsId, apiKey, pageToken, maxResults, authHeader));
      }
      res.status(400).json({ error: 'channelId or Authorization header required' });
      return;
    }

    const chanResp = await fetch(chanUrl.toString());
    const chanData = await chanResp.json() as { items?: Array<{ contentDetails: { relatedPlaylists: { uploads: string } } }> };
    const uploadsId = chanData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsId) { res.status(404).json({ error: 'Channel not found' }); return; }

    res.json(await fetchPlaylistItems(uploadsId, apiKey, pageToken, maxResults));
  } catch (err) {
    console.error('[videos]', err);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

async function fetchPlaylistItems(
  playlistId: string,
  apiKey: string,
  pageToken: string | undefined,
  maxResults: string,
  authHeader?: string,
): Promise<object> {
  const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
  url.searchParams.set('part', 'snippet,contentDetails');
  url.searchParams.set('playlistId', playlistId);
  url.searchParams.set('maxResults', maxResults);
  url.searchParams.set('key', apiKey);
  if (pageToken) url.searchParams.set('pageToken', pageToken);

  const headers: Record<string, string> = {};
  if (authHeader) headers['Authorization'] = authHeader;

  const resp = await fetch(url.toString(), { headers });
  const data = await resp.json() as {
    items?: Array<{
      contentDetails: { videoId: string; videoPublishedAt: string };
      snippet: { title: string; channelTitle: string; thumbnails: { default: { url: string } } };
    }>;
    nextPageToken?: string;
    pageInfo?: { totalResults: number };
  };

  const items = (data.items ?? []).map((item) => ({
    videoId: item.contentDetails.videoId,
    title: item.snippet.title,
    artist: item.snippet.channelTitle,
    thumbnailUrl: item.snippet.thumbnails?.default?.url ?? null,
    publishedAt: item.contentDetails.videoPublishedAt,
  }));

  return {
    items,
    nextPageToken: data.nextPageToken ?? null,
    totalResults: data.pageInfo?.totalResults ?? items.length,
  };
}
