(function() {
'use strict';

let verbose = false;

let info;
if (verbose)
  info = console.info.bind(console);
else
  info = function() {};

let log = console.log.bind(console);
let error = console.error.bind(console);

chrome.runtime.onInstalled.addListener(function() {
  let oldIds = new Set();

  let domains = new Map([['chromium.org', 1], ['google.com', 0]]);

  let MAX_REDIRECTS = 10;
  let MAX_REDIRECT_INTERVAL = 1000;
  let timerId = null;
  let numRedirects = 0;

  let resetRedirects = function() {
    timerId = null;
    numRedirects = 0;
  };

  let beforeRequestCallback = function(details) {
    // Don't process the same request twice.
    if (oldIds.has(details.requestId)) {
      info('Already processed this request.');
      return;
    }

    let url = new URL(details.url);
    let params = url.searchParams;

    // If the URL specifies the authuser, don't override it.
    if (params.has('authuser')) {
      info('Ignoring authuser in URL.');
      return;
    }

    // Assume the auth key means you explicitly specified an account.
    if (params.has('auth')) {
      log('Ignoring auth in URL.');
      return;
    }

    info(details.method + ':  ' + details.url);

    let domain;

    if (url.pathname.startsWith('/a/')) {
      let domainStart = 3;
      let domainEnd = url.pathname.indexOf('/', domainStart);
      // Get up to the '/', or to the end of the pathname if '/' was not found.
      domain = url.pathname.substring(domainStart, Math.max(domainEnd, 0));
      log('Domain: ' + domain);
    }

    if (!domain) {
      log('No domain found...');
      return;
    }

    let authuser = domains.get(domain);
    if (authuser === undefined) {
      error('No athuser found for domain! ' + domain);
      return;
    }

    info('Should use authuser=' + authuser);

    numRedirects++;
    if (numRedirects == MAX_REDIRECTS) {
      error('Exceeded maximum number of redirects in interval');
      return;
    }
    if (timerId === null)
      timerId = setTimeout(resetRedirects, MAX_REDIRECT_INTERVAL);

    oldIds.add(details.requestId);

    params.set('authuser', authuser);
    return {redirectUrl: url.toString()};
  };

  let filter = {
    urls: ['*://groups.google.com/*'],
    types: ['main_frame'],
  };

  // Blocking so we can redirect.
  let extraInfoSpec = ['blocking'];

  // Register redirect rules.
  chrome.webRequest.onBeforeRequest.addListener(
      beforeRequestCallback, filter, extraInfoSpec);

});

})();
