export const config = {
	domainSource: 'https://www.frenchdetailers.com', // Your WeWeb app preview link
	patterns: [
		{
			pattern: '/company/[^/]+',
			metaDataEndpoint:
				'https://ljplutjhayfqdoxssdri.supabase.co/rest/v1/public_view_metadata_companies?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqcGx1dGpoYXlmcWRveHNzZHJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTA2ODc5NjQsImV4cCI6MjAyNjI2Mzk2NH0.k1osx2d-JHlBAHuv4niOCVPt50SFtr2FhdCFdvoBfk8&select=title,description,image,keywords&or=%28and%28id.eq.%22{id}%22%29%29',
		},
	],
};
