import type {NextConfig} from 'next';
const nextConfig:NextConfig={reactStrictMode:true,outputFileTracingIncludes:{'/*':['./catalog-release.json']}};
nextConfig.env={...(nextConfig.env??{}),...{"CATALOG_DATA_MODE":"public_release","CATALOG_OWNER_MODE":"disabled","CATALOG_REVIEW_MODE":"disabled","CATALOG_PUBLIC_FILE":"","KASHOUROKU_FEEDBACK_FORM_URL":"https://docs.google.com/forms/d/e/1FAIpQLSf__uiKF6mvFKQ0dZVMHUzt7Eolugu8mMd1s_ptZCwbevFshQ/viewform"}};
export default nextConfig;
