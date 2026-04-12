import { NotionAPI } from 'notion-client'

const notionAPI = new NotionAPI({
  apiBaseUrl: process.env.NOTION_API_BASE_URL
})

// Rate limiter: serialize all Notion API requests to avoid 429 errors
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Timeout wrapper to prevent hanging requests
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms)
    )
  ])
}

let requestQueue = Promise.resolve()

// Retry wrapper with exponential backoff
const withRetry = async <T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 5000
): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === retries - 1) throw err
      console.warn(
        `Retry ${i + 1}/${retries} after error:`,
        (err as Error).message
      )
      await sleep(delay * (i + 1)) // exponential backoff
    }
  }
  throw new Error('Unreachable')
}

// Wrapper that serializes getPage calls with delay and retry
export const notion = {
  ...notionAPI,
  getPage: async (
    pageId: string,
    options?: Parameters<typeof notionAPI.getPage>[1]
  ) => {
    const result = requestQueue.then(async () => {
      try {
        const page = await withRetry(
          () => withTimeout(notionAPI.getPage(pageId, options), 30000),
          3,
          5000
        )
        await sleep(2000)
        return page
      } catch (err) {
        // Log error but don't block the queue
        console.error(`Failed to load page ${pageId}:`, err)
        throw err
      }
    })
    // Always advance the queue, even on error
    requestQueue = result.then(
      () => {},
      () => {}
    )
    return result
  },
  search: notionAPI.search.bind(notionAPI)
}
