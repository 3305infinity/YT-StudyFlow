(function () {
  const statusEl = document.getElementById('status');

  function fail(message) {
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = 'error';
    }
  }

  try {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = hash.get('token');

    if (!token) {
      fail('Sign-in failed: no session token received.');
      return;
    }

    chrome.storage.local.set({ studyflow_auth_token: token }, () => {
      if (chrome.runtime.lastError) {
        fail('Could not save session. Try again.');
        return;
      }

      chrome.runtime.sendMessage({ type: 'YT_STUDYFLOW_AUTH_COMPLETE' }, () => {
        if (statusEl) statusEl.textContent = 'Signed in! You can close this window.';
        setTimeout(() => window.close(), 400);
      });
    });
  } catch (e) {
    fail(e instanceof Error ? e.message : 'Sign-in failed.');
  }
})();
