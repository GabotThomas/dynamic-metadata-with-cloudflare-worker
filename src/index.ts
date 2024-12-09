import { config } from '../config.js';

export default {
	async fetch(request, env, ctx) {
		// Extracting configuration values
		const domainSource = config.domainSource;
		const patterns = config.patterns;

		console.log('Start worker');

		// Parse the request URL
		const url = new URL(request.url);
		const referer = request.headers.get('Referer');

		// Function to get the pattern configuration that matches the URL
		function getPatternConfig(url) {
			for (const patternConfig of patterns) {
				const regex = new RegExp(patternConfig.pattern);
				let pathname = url + (url.endsWith('/') ? '' : '/');
				if (regex.test(pathname)) {
					return patternConfig;
				}
			}
			return null;
		}

		// Function to check if the URL matches the page data pattern (For the WeWeb app)
		function isPageData(url) {
			const pattern = /\/public\/data\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.json/;
			return pattern.test(url);
		}

		async function requestMetadata(url, metaDataEndpoint) {
			// Remove any trailing slash from the URL
			const trimmedUrl = url.endsWith('/') ? url.slice(0, -1) : url;

			// Split the trimmed URL by '/' and get the last part: The id
			const parts = trimmedUrl.split('/');
			const id = parts[parts.length - 1];

			// Replace the placeholder in metaDataEndpoint with the actual id
			const placeholderPattern = /{([^}]+)}/;
			const metaDataEndpointWithId = metaDataEndpoint.replace(placeholderPattern, id);

			// Fetch metadata from the API endpoint
			const metaDataResponse = await fetch(metaDataEndpointWithId);

			if (!metaDataResponse.ok) {
				return null;
			}

			let metadata = await metaDataResponse.json();

			if (Array.isArray(metadata)) {
				metadata = metadata[0];
			}

			return metadata;
		}

		// Handle dynamic page requests
		const patternConfig = getPatternConfig(url.pathname);
		if (patternConfig) {
			console.log('isPattern:', referer);
			// Fetch the source page content
			let source = await fetch(`${domainSource}${url.pathname}`);

			// Remove "X-Robots-Tag" from the headers
			const sourceHeaders = new Headers(source.headers);
			sourceHeaders.delete('X-Robots-Tag');
			source = new Response(source.body, {
				status: source.status,
				headers: sourceHeaders,
			});

			const metadata = await requestMetadata(url.pathname, patternConfig.metaDataEndpoint);

			// Create a custom header handler with the fetched metadata
			const customHeaderHandler = new CustomHeaderHandler(metadata);

			// Transform the source HTML with the custom headers
			return new HTMLRewriter().on('*', customHeaderHandler).transform(source);

			// Handle page data requests for the WeWeb app
		} else if (isPageData(url.pathname)) {
			console.log('not first :', referer);

			// Fetch the source data content
			const sourceResponse = await fetch(`${domainSource}${url.pathname}`);
			let sourceData = await sourceResponse.json();

			let pathname = referer;
			pathname = pathname ? pathname + (pathname.endsWith('/') ? '' : '/') : null;
			if (pathname !== null) {
				console.log('path', pathname, url.pathname);
				const patternConfigForPageData = getPatternConfig(pathname);
				if (patternConfigForPageData) {
					console.log('is partern :', referer);
					const metadata = await requestMetadata(pathname, patternConfigForPageData.metaDataEndpoint);

					if (metadata) {
						console.log('Metadata fetched:', metadata.title);

						// Ensure nested objects exist in the source data
						sourceData.page = sourceData.page || {};
						sourceData.page.title = sourceData.page.title || {};
						sourceData.page.meta = sourceData.page.meta || {};
						sourceData.page.meta.desc = sourceData.page.meta.desc || {};
						sourceData.page.meta.keywords = sourceData.page.meta.keywords || {};
						sourceData.page.socialTitle = sourceData.page.socialTitle || {};
						sourceData.page.socialDesc = sourceData.page.socialDesc || {};

						// Update source data with the fetched metadata
						if (metadata.title) {
							sourceData.page.title.en = metadata.title;
							sourceData.page.socialTitle.en = metadata.title;
						}
						if (metadata.description) {
							sourceData.page.meta.desc.en = metadata.description;
							sourceData.page.socialDesc.en = metadata.description;
						}
						if (metadata.image) {
							sourceData.page.metaImage = metadata.image;
						}
						if (metadata.keywords) {
							sourceData.page.meta.keywords.en = metadata.keywords;
						}
					}

					// Return the modified JSON object
					return new Response(JSON.stringify(sourceData), {
						headers: { 'Content-Type': 'application/json' },
					});
				}
			}
		}

		// If the URL does not match any patterns, fetch and return the original content
		const sourceUrl = new URL(`${domainSource}${url.pathname}`);
		const sourceRequest = new Request(sourceUrl, request);
		const sourceResponse = await fetch(sourceRequest);

		// Create a new response without the "X-Robots-Tag" header
		const modifiedHeaders = new Headers(sourceResponse.headers);
		modifiedHeaders.delete('X-Robots-Tag');

		return new Response(sourceResponse.body, {
			status: sourceResponse.status,
			headers: modifiedHeaders,
		});
	},
};

// CustomHeaderHandler class to modify HTML content based on metadata
class CustomHeaderHandler {
	constructor(metadata) {
		this.metadata = metadata;

		if (this.metadata?.title) {
			console.log('Metadata fetched:', metadata.title);
		}
	}

	element(element) {
		if (!this.metadata) {
			return;
		}
		// Replace the <title> tag content
		if (element.tagName == 'title') {
			element.setInnerContent(this.metadata.title);
		}
		// Replace meta tags content
		if (element.tagName == 'meta') {
			const name = element.getAttribute('name');
			switch (name) {
				case 'title':
					element.setAttribute('content', this.metadata.title);
					break;
				case 'description':
					element.setAttribute('content', this.metadata.description);
					break;
				case 'image':
					element.setAttribute('content', this.metadata.image);
					break;
				case 'keywords':
					element.setAttribute('content', this.metadata.keywords);
					break;
				case 'twitter:title':
					element.setAttribute('content', this.metadata.title);
					break;
				case 'twitter:description':
					element.setAttribute('content', this.metadata.description);
					break;
			}

			const itemprop = element.getAttribute('itemprop');
			switch (itemprop) {
				case 'name':
					element.setAttribute('content', this.metadata.title);
					break;
				case 'description':
					element.setAttribute('content', this.metadata.description);
					break;
				case 'image':
					element.setAttribute('content', this.metadata.image);
					break;
			}

			const type = element.getAttribute('property');
			switch (type) {
				case 'og:title':
					element.setAttribute('content', this.metadata.title);
					break;
				case 'og:description':
					element.setAttribute('content', this.metadata.description);
					break;
				case 'og:image':
					element.setAttribute('content', this.metadata.image);
					break;
			}

			// Remove the noindex meta tag
			const robots = element.getAttribute('name');
			if (robots === 'robots' && element.getAttribute('content') === 'noindex') {
				element.remove();
			}
		}
	}
}
