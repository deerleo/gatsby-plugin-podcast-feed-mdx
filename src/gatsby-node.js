const RSS = require(`rss`)
const path = require(`path`)
const fs = require(`fs-extra`)
const entities = require(`entities`)

const wrapper = (promise) =>
  promise.then((result) => {
    if (result.errors) {
      throw result.errors
    }
    return result
  })

// Create an rss feed for our podcast based on options from:
//  - gatsby-config for the overall podcast itself, and
//  - individual mdx files for each episode.
// Output the feed to a local file.
exports.onPostBuild = async ({ graphql }, pluginOptions) => {
  // get the options for the podcast iteself
  const feedOptions = {
    title: pluginOptions.title,
    description: pluginOptions.description,
    site_url: pluginOptions.siteUrl,
    feed_url: pluginOptions.feedUrl,
    image_url: pluginOptions.imageUrl,
    language: pluginOptions.language,
    copyright: pluginOptions.copyright,
    docs: `https://help.apple.com/itc/podcasts_connect/#/itcb54353390`,
    author: pluginOptions.authorName,
    managingEditor: pluginOptions.managingEditor,
    webMaster: pluginOptions.webMaster,
    categories: [pluginOptions.category1, pluginOptions.category2, pluginOptions.category3],
    pubDate: pluginOptions.publicationDate,

    ttl: pluginOptions.timeToLive,
    generator: `https://github.com/miller-productions/gatsby-plugin-podcast-feed-mdx`,
    custom_namespaces: {
      itunes: `http://www.itunes.com/dtds/podcast-1.0.dtd`,
      googleplay: `http://www.google.com/schemas/play-podcasts/1.0`,
    },
    custom_elements: [
      { "itunes:title": pluginOptions.title },
      { "itunes:subtitle": pluginOptions.subtitle },
      { "itunes:summary": pluginOptions.summary.substring(0, 3999) },
      { "itunes:type": pluginOptions.podcastType },
      { "itunes:explicit": pluginOptions.explicit },
      { "itunes:author": pluginOptions.authorName },
      { "itunes:owner": [{ "itunes:name": pluginOptions.ownerName }, { "itunes:email": pluginOptions.ownerEmail }] },
      {
        "itunes:image": {
          _attr: {
            href: pluginOptions.imageUrl,
          },
        },
      },
      {
        "itunes:category": [
          {
            _attr: {
              text: pluginOptions.category1,
            },
          },
          {
            "itunes:category": {
              _attr: {
                text: pluginOptions.subCategory1,
              },
            },
          },
        ],
      },
      {
        "itunes:category": [
          {
            _attr: {
              text: pluginOptions.category2,
            },
          },
          {
            "itunes:category": {
              _attr: {
                text: pluginOptions.subCategory2,
              },
            },
          },
        ],
      },
      {
        "itunes:category": [
          {
            _attr: {
              text: pluginOptions.category3,
            },
          },
          {
            "itunes:category": {
              _attr: {
                text: pluginOptions.subCategory3,
              },
            },
          },
        ],
      },
      { "googleplay:author": pluginOptions.authorName },
      { "googleplay:description": pluginOptions.summary.substring(0, 999) },
      { "googleplay:explicit": pluginOptions.explicit },
    ],
  }

  // create the rss feed
  const feed = new RSS(feedOptions)

  // get the options for the episodes
  const result = await wrapper(
    graphql(`
      query {
        podcastEpisodes: allMdx(filter: { frontmatter: { status: { eq: "published" }, type: { eq: "podcast" } } }) {
          edges {
            node {
              excerpt
              body
              id
              frontmatter {
                title
                slug
                guid
                subtitle
                url
                season
                episodeNumber
                episodeType
                publicationDate
                author
                size
                duration
                explicit
                categories
              }
            }
          }
        }
      }
    `)
  )
  const episodes = result.data.podcastEpisodes.edges

  // for each episode
  episodes.forEach((edge) => {
    // gather the options
    const { body, excerpt } = edge.node
    const {
      title,
      slug,
      guid,
      subtitle,
      url,
      season,
      episodeNumber,
      episodeType,
      publicationDate,
      author,
      size,
      duration,
      explicit,
      categories,
    } = edge.node.frontmatter

    // add an episode item to the feed using the options
    feed.item({
      guid,
      title,
      date: publicationDate,
      description: excerpt,
      url: pluginOptions.siteUrl + slug,
      categories,
      author,
      custom_elements: [
        { "itunes:title": title },
        { "itunes:subtitle": subtitle },
        season && { "itunes:season": season },
        episodeNumber && { "itunes:episode": episodeNumber },
        { "itunes:duration": duration },
        { "itunes:episodeType": episodeType },
        { "itunes:explicit": explicit },
        { "itunes:summary": excerpt },
        { "itunes:author": author },
        {
          "itunes:image": {
            _attr: {
              href: feedOptions.image_url,
            },
          },
        },
        { "googleplay:description": excerpt },
        { "googleplay:explicit": explicit },
        { "content:encoded": { _cdata: entities.decodeHTML(body) } },
      ],
      enclosure: {
        url,
        size,
        type: `audio/mpeg`,
      },
    })
  })

  // write the rss out to a file
  const publicPath = `./public`
  const outputPath = path.join(publicPath, pluginOptions.outputPath)
  const outputDir = path.dirname(outputPath)
  if (!(await fs.exists(outputDir))) {
    await fs.mkdirp(outputDir)
  }
  await fs.writeFile(outputPath, feed.xml())
}
