import path from 'path';

const config = {
  webpack: (webpackConfig) => {
    webpackConfig.resolve.alias['@utils'] = path.join(process.cwd(), 'app/utils');
    return webpackConfig;
  },
};

export default config;
