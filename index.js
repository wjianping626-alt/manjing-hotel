module.exports = (req, res) => {
  if (req.url.startsWith('/api/')) {
    // 导入并转发给 API handler
    delete require.cache[require.resolve('./api/generate-trip')];
    return require('./api/generate-trip')(req, res);
  }

  // 所有非 API 请求直接返回 index.html
  res.status(200).send('OK');
};
