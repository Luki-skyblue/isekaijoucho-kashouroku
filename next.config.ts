import type {NextConfig} from 'next';
const nextConfig:NextConfig={reactStrictMode:true,outputFileTracingIncludes:{'/*':['./catalog-release.json']}};
nextConfig.env={...(nextConfig.env??{}),...{"CATALOG_DATA_MODE":"public_release","CATALOG_OWNER_MODE":"disabled","CATALOG_REVIEW_MODE":"disabled","CATALOG_PUBLIC_FILE":"","KASHOUROKU_FEEDBACK_FORM_URL":""}};
export default nextConfig;
