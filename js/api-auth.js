/**
 * Authenticated fetch (Bearer token from sessionStorage).
 * @param {RequestInit & { auth401Redirect?: string }} options
 */
(function () {
  window.juniorFetchWithAuth = async function juniorFetchWithAuth(url, options = {}) {
    const { auth401Redirect, ...fetchOptions } = options;
    const loginUrl = auth401Redirect !== undefined ? auth401Redirect : 'portal.html';

    let token = sessionStorage.getItem('userToken') || sessionStorage.getItem('accessToken');
    let headers = { ...fetchOptions.headers };

    if (!token) {
      throw new Error('No authentication token available');
    }

    headers['Authorization'] = `Bearer ${token}`;
    const hasBody = fetchOptions.body !== undefined && fetchOptions.body !== null;
    if (hasBody && !(fetchOptions.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    let response = await fetch(url, { ...fetchOptions, headers });

    if (response.status === 401) {
      console.warn('Access token expired or invalid. Redirecting to login...');
      sessionStorage.clear();
      window.location.href = loginUrl;
      return response;
    }

    return response;
  };
})();
