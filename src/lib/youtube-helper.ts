/**
 * Helper per estrarre informazioni di base o trascrizioni da link YouTube
 */

export interface YouTubeInfo {
  videoId?: string;
  title?: string;
  authorName?: string;
  rawText?: string;
}

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  return match ? match[1] : null;
}

export async function fetchYouTubeDetails(url: string): Promise<YouTubeInfo> {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    return { rawText: `Link video YouTube: ${url}` };
  }

  try {
    // Utilizza l'endpoint oEmbed di YouTube (pubblico, supportato da Google senza API key)
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl, { next: { revalidate: 3600 } });
    
    if (res.ok) {
      const data = await res.json();
      return {
        videoId,
        title: data.title,
        authorName: data.author_name,
        rawText: `Titolo Video: "${data.title}"\nAutore/Canale: ${data.author_name}\nURL: https://www.youtube.com/watch?v=${videoId}`,
      };
    }
  } catch (e) {
    console.warn('[fetchYouTubeDetails] Impossibile recuperare oEmbed YouTube:', e);
  }

  return {
    videoId,
    rawText: `Video YouTube ID: ${videoId} (URL: ${url})`,
  };
}
