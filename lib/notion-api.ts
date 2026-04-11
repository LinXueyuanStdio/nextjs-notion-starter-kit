import { NotionAPI } from 'notion-client'

const notionAPI = new NotionAPI({
  apiBaseUrl: process.env.NOTION_API_BASE_URL
})

// Rate limiter: serialize all Notion API requests to avoid 429 errors
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
let requestQueue = Promise.resolve()

// Wrapper that serializes getPage calls with delay
export const notion = {
  ...notionAPI,
  getPage: async (pageId: string, options?: Parameters<typeof notionAPI.getPage>[1]) => {
    const result = requestQueue.then(async () => {
      const page = await notionAPI.getPage(pageId, options)
      await sleep(500)
      return page
    })
    requestQueue = result.then(() => {}, () => {})
    return result
  },
  search: notionAPI.search.bind(notionAPI)
}
